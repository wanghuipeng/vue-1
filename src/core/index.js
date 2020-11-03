import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'

/* 在引用Vue的时候给Vue初始化一些全局配置和API */
initGlobalAPI(Vue)

/* 在Vue.protoType上添加$isServer属性，该属性代理了isServerRendering方法，该属性一般用于服务器渲染，监听是否是服务器环境 */
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

/* 在Vue.protoType上添加$ssrContext属性，该属性代理了this.$vnode.ssrContext方法 */
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get () {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

/* 在ssr运行时安装FunctionalRenderContext */
// expose FunctionalRenderContext for ssr runtime helper installation
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

/* Vue.version 存储了当前 Vue 的版本号 */
Vue.version = '__VERSION__'

export default Vue
