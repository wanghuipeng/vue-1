/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/* 通过proxy函数将_data或者_props等上面的数据代理到vm实例上，这样就可以用app.text代替app._data.text了 */
export function proxy (target: Object, sourceKey: string, key: string) {
  /* 设置set函数 */
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  /* 设置get函数 */
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  /* 设置监听观察者 */
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/* 初始化状态（props、methods、data、computed、watch） */
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    /* 该组件没有data的时候绑定一个空对象 */
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/* 初始化props */
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  /* 缓存属性的key，使得将来能直接使用数组的索引来更新props来代替动态的枚举对象 */ 
  const keys = vm.$options._propKeys = []
  /* 根据$parent是否存在来判断当前是否是根节点 */
  const isRoot = !vm.$parent
  // root instance props should be converted
  /* 如果根节点不存在则不监听观察者 */
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      /* 判断是否是保留字段，如果是则发出警告 */
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    /* 如果vm上没有props属性，而原型上有，则把使用this.[propsKey]来获取值 */
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  /* 设置监听观察者 */
  toggleObserving(true)
}

/* 初始化data */
function initData (vm: Component) {
  /* 获取data中的数据 */
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      /* 如果数据中的key与事件中定义的key一样则发出警告 */
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    /* 如果数据中的key与props中定义的key一样则发出警告 */
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) { /* 如果不是以$或_开头 */
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  /* 进行双向数据绑定 */
  observe(data, true /* asRootData */)
}

/* 如果数据是函数类型，则执行该函数获取数据 */
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

/* 初始化computed */
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  /* 创建一个新的监听者空对象 */
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  /* 判断是否是node服务器环境 */
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    /* 如果computed属性不存在与虚拟dom，则定义该计算属性，并把该属性的数据添加到对象监听中 */
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

/* 定义计算属性 */
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  /* 添加监听观察者（即添加对象监听） */
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/* 创建计算属性的getter */
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      /* 实际是脏查询，在计算属性中的依赖发生改变时dirty会变为true，在get的时候重新计算计算属性的输出值 */
      if (watcher.dirty) {
        watcher.evaluate()
      }
      /* 依赖收集 */
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

/*  */
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

/* 初始化方法 */
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    /* 判断方法是否是函数类型，如果不是则设置为空函数，如果时则执行该函数 */
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

/* 初始化Watch监听 */
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    /* 如果是数组handler */
    if (Array.isArray(handler)) {
      /* 循环数组，创建监听 */
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

/* 为数据创建Watcher观察者 */
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  /* 只有当对象是纯js对象的时候返回true */
  if (isPlainObject(handler)) {
    /*
      这里是当watch的写法是这样的时候
      watch: {
          test: {
              handler: function () {},
              deep: true
          }
      }
    */
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  /* 用$watch方法创建一个watch来观察对象的变化 */
  return vm.$watch(expOrFn, handler, options)
}

/* 数据绑定 */
export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)
  
  /* 添加一个数组数据或对象数据 */
  Vue.prototype.$set = set
  /* 删除一个数组数据或对象数据 */
  Vue.prototype.$delete = del
  
  /* 用来为对象建立观察者，监听变化 */
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    /* 有immediate参数的时候会立即执行 */
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    /* 返回一个取消观察函数，用来停止触发回调 */
    return function unwatchFn () {
      /* 将自身从所有依赖收集订阅列表中删除 */
      watcher.teardown()
    }
  }
}
