import { globSync } from 'glob'
import { getCompPath, getMatchPath, getMeta, getRoutePath, toCamel } from './tools'
import { writeFileSync } from 'node:fs'
import serialize from 'serialize-javascript'


const RAW_PATH = Symbol('rawPath'),
    /** 把路由参数替换的正则: /path/[param$] => /path/:param? */
    REG_PARAM = /\[(\w+)(\$)?\]/g,
    /** 匹配 param 的正则 */
    REG_GET_PARAM = /\/:\w+\??/g

let ROOT_PATH = '/src/views'


/**
 * '/src/views' 下的每个文件夹 必须有`index.vue`
 *
 * param 参数，使用`[]`包裹： `/about[param]`
 *
 * 可选 param，使用 `$` 结尾： `about/[param$]`
 *
 * `meta` 为可选 必须使用默认导出
 *
 * **注意，meta文件里，不可以写参数类型，不可以写扩展运算符，因为是用`eval`转换的**
 *
 * `meta` 里的 *beforeEnter* | *redirect* 会被提取出来
 *
 * @returns 生成路由配置
 * @example
 * { component, meta, path, name, beforeEnter, redirect }
 */
function genRoutes(opts: Opts = {}): RouteItem[] | void {
    const { rootPath, space = 4, writePath } = opts

    ROOT_PATH = normalizePath(rootPath)
    const routeMap = genRouteMap()
    const routeTarget = hanldeNest(routeMap)
    const routes = Object.values(routeTarget) as RouteItem[]

    if (!writePath) {
        return routes
    }

    let routeStr = serialize(routes, {
        space,
        unsafe: true
    })
    routeStr = `export const routes = ${routeStr}`
    writeFileSync(writePath, routeStr)
}

export default genRoutes
export {
    genRoutes
}



/**
 * @returns @example
 * '/src/views/News/' => [{ component, meta, path, name }, ...]
 */
function genRouteMap() {
    const metaArr = globSync(getMatchPath(ROOT_PATH + '/**/meta.*'))
    const compArr = globSync(getMatchPath(ROOT_PATH + '/**/*.vue'))
    const routeMap = new Map<string, RouteItem>()

    compArr.forEach((item) => {
        const compPath = getRoutePath(item, ROOT_PATH),
            basePath = compPath.replace('/index.vue', ''),
            component = eval(`(() => import('${getCompPath(compPath)}'))`),
            metaPath = metaArr.find((m) => {
                const _metaPath = getRoutePath(m, ROOT_PATH).replace(/\/meta.*/, '')
                if (basePath === _metaPath) {
                    return true
                }
            }),
            meta = metaPath ? getMeta(metaPath) : {},

            path = basePath.replace(ROOT_PATH, '') || '/',
            paramPath = matchPath(path),

            name = path.slice(1) || 'index',
            /** 名字排除掉通配符 */
            _name = name.replace(REG_PARAM, '')

        routeMap.set(basePath, {
            component,
            name: _name,
            path: paramPath,
            meta,
        })
    })
    return routeMap
}

function matchPath(path: string) {
    if (path === '/') return path

    return path.replace(REG_PARAM, (_all: any, param: string, wildcard: string) => {
        return `/:${param}${wildcard ? '?' : ''}`
    })
}

function hanldeNest(routeMap: Map<string, RouteItem>) {
    /** 最终包含 children 的嵌套对象 */
    const parentTarget: any = {},
        /** 临时存放子路由 */
        childTarget: any = {}

    for (const [_basePath, route] of routeMap) {
        splitParentAndChild(route)
    }

    const delPathArr: string[] = []
    appendToParent()
    return parentTarget


    function splitParentAndChild({ component, name, path, meta }: RouteItem) {
        const _path = path.replace(ROOT_PATH, '') || '/'
        /** /path/path2 => ['', 'path', 'path2', ...] */
        const pathChunk = _path.split('/')
        let len = pathChunk.length

        /** 说明也是根目录 */
        if (len === 3 && pathChunk[2].startsWith(':')) {
            len = 2
        }

        /** 不能用 `delete meta.beforeEnter` 会导致下次调用无法读取 */
        const _meta: any = {}
        const { beforeEnter, redirect } = meta
        for (const k in meta) {
            if (
                !Object.hasOwnProperty.call(meta, k) ||
                ['beforeEnter', 'redirect'].includes(k)
            ) continue

            _meta[k] = meta[k]
        }

        if (len === 2) {
            const parent = pathChunk[1] || '/'
            parentTarget[parent] = {
                path,
                name,
                meta: _meta,
                component,
                children: [],
                ...(beforeEnter ? { beforeEnter } : {}),
                ...(redirect ? { redirect } : {}),
            }
        }
        else {
            /** 子路由 采用驼峰命名法 */
            const _name = toCamel(name, '/')
            /** 去除头部的 `/` 作为键 */
            const key = pathChunk.join('/').slice(1)

            childTarget[key] = {
                /** 留着下面方便对比的 */
                [RAW_PATH]: path.slice(1),
                /** 子路由仅需后面作为路径 */
                path: genChildPath(),
                name: _name,
                meta: _meta,
                component,
                children: [],
                ...(beforeEnter ? { beforeEnter } : {}),
                ...(redirect ? { redirect } : {}),
            }
        }

        /** 有 param 的，则拼接上去 */
        function genChildPath() {
            let path = ''
            const pathArr: string[] = []
            for (let i = pathChunk.length - 1; i >= 0; i--) {
                const pathItem = pathChunk[i]
                if (pathItem.startsWith(':')) {
                    pathArr.unshift(pathItem)
                }
                else {
                    path = pathItem
                    break
                }
            }

            if (pathArr.length) {
                return path + '/' + pathArr.join('/')
            }
            return path
        }
    }

    /**
     * 把子节点 加入父节点
     * @param pathLen 从二级开始查找 逐渐递归查找更深的层级
     */
    function appendToParent(pathLen = 2) {
        for (const path in childTarget) {
            if (!Object.hasOwnProperty.call(childTarget, path)) continue

            const child = childTarget[path]

            /** /path/path2 => ['', 'path', 'path2'] */
            /** parame 路由其实是同一个节点 所以过滤掉 :param */
            const pathChunk = path.split('/').filter((p) => !p.startsWith(':')),
                pathChunkLen = pathChunk.length
            if (
                pathChunkLen === pathLen
            ) {
                /** 每次都拼接上前面的父亲路径 */
                const parentPathArr = Array.from({ length: pathLen - 1 }).map((_, i) => i),
                    parentPath = parentPathArr.map((i) => pathChunk[i]).join('/'),
                    parent = getParent(parentPath)

                if (parent) {
                    parent.children.push({
                        ...child,
                        /** 子节点 不需要以 / 开头 */
                        path: child.path
                    })
                    /** 完成一遍放入数组 后续删除 */
                    delPathArr.push(path)
                }
            }
        }

        delPathArr.forEach((p) => delete childTarget[p])
        delPathArr.splice(0)
        if (Object.keys(childTarget).length === 0) return

        appendToParent(pathLen + 1)
    }

    function getParent(path: string): any {
        const pathArr = path.split('/')

        let target: any,
            composePath = ''
        for (let i = 0; i < pathArr.length; i++) {
            if (i === 0) {
                composePath += pathArr[i]
            }
            else {
                composePath += `/${pathArr[i]}`
            }

            /** 第一层 直接找 */
            if (i === 0) {
                target = parentTarget[composePath]
                if (!target) {
                    return null
                }
            }
            else {
                target = findTargetByChildren()
                if (!target) return null
            }
        }
        return target


        function findTargetByChildren() {
            const children = target.children

            for (let i = 0; i < children.length; i++) {
                const child = children[i]
                const rawPath = child[RAW_PATH].replace(REG_GET_PARAM, '')
                if (composePath === rawPath) {
                    return child
                }
            }
            return null
        }
    }
}


/** 统一路径为 /src/views */
function normalizePath(rootPath?: string) {
    if (!rootPath) return ROOT_PATH

    if (rootPath.startsWith('.')) {
        rootPath = rootPath.slice(1)
    }
    if (!rootPath.startsWith('/')) {
        rootPath = '/' + rootPath
    }
    if (rootPath.endsWith('/')) {
        rootPath = rootPath.slice(0, -1)
    }

    return rootPath
}


export type Opts = {
    /** 要写入的路径 不填则返回一个路由数组 */
    writePath?: string
    /** 路由文件夹路径 默认 /src/views */
    rootPath?: string
    /** 写入格式化空格 */
    space?: 2 | 4
}

type RouteItem = {
    path: string
    name: string
    component: any
    meta: Record<string, any>
}
