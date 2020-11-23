/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      /* 初始化内部组件 */
      initInternalComponent(vm, options)
    } else {
      /* 合并参数，将两个对象合并成一个对象，将父对象的值和子对象的值合并，优先取子对象的值 */
      vm.$options = mergeOptions(
        /* 解析constructor上的参数属性 */
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    /* 触发beforeCreate钩子函数 */
    callHook(vm, 'beforeCreate')
    /* 该方法在data/props之前被完成 */
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    /* 触发created钩子函数 */
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  /* 把组件构造函数的options挂载到vm.$options的_proto_上 */
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  
  /* 把传入参数的option的_parentVnode挂载到组件实例$options上 */
  const parentVnode = options._parentVnode   /* _parentVnode是该组件实例的vnode对象 */
  /* 把传入参数的option的parent挂载到组件实例$options上 */
  opts.parent = options.parent /*  parent是该组件的父组件对象（根实例） */
  opts._parentVnode = parentVnode
  
  /* 组件参数 */
  const vnodeComponentOptions = parentVnode.componentOptions
  /* 组件数据 */
  opts.propsData = vnodeComponentOptions.propsData
  /* 组件事件 */
  opts._parentListeners = vnodeComponentOptions.listeners
  /* 组件子节点 */
  opts._renderChildren = vnodeComponentOptions.children
  /* 组件的标签 */
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    /* 渲染函数 */
    opts.render = options.render
    /* 静态渲染函数 */
    opts.staticRenderFns = options.staticRenderFns
  }
}

/* 解析构造函数的参数，合并、过滤重复的参数 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  /* 有super属性，说明Ctor是Vue.extend构建的子类 */
  if (Ctor.super) { // 超类
    /* 回调超类，表示继承父类，获取父类正确的options */
    const superOptions = resolveConstructorOptions(Ctor.super)
    /* 获取执行Child = Parent.extend()时缓存的父类的options */
    const cachedSuperOptions = Ctor.superOptions
    /* 对两者通过比较来判断之后是否改变过，如果通过.mixin、.extend导致父类继承的值改变了，也就导致options改变了，如果改变了，就进行修正 */    
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      /* 解析新增的那部分options */
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      /* 合并两个对象，优先取Ctor.extendOptions */
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
