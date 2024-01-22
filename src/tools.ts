import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'


const REG_META = /\s*export default\s*(\{[\s\S]*\})/

/** 返回相对于命令行的路径拼接 */
export function getMatchPath(path: string) {
    /** 统一路径 不能是绝对路径拼接 */
    if (path.startsWith('/')) path = path.slice(1)
    return resolve(path).replace(/\\/g, '/')
}

export function getMeta(src: string) {
    const code = readFileSync(src, 'utf-8')
    const match = code.match(REG_META)

    if (match) return eval('(' + match[1] + ')')
    return {}
}

/** 返回命令行起始路径 比如`C:\\code\\src\\views` => `/src/views` */
export function getRoutePath(str: string, rootPath: string) {
    /** 统一路径为 /src/views */
    if (rootPath.startsWith('.')) rootPath = rootPath.slice(1)
    if (!str.startsWith('/')) str = '/' + str
    if (str.endsWith('/')) str = str.slice(0, -1)

    str = str.replace(/\\/g, '/')
    const i = str.search(rootPath)
    return str.slice(i)
}

/**
 * 蛇形转驼峰 也可以指定转换其他的
 * @param key 需要转换的字符串
 * @param replaceStr 默认是 `_`，也就是蛇形转驼峰
 * @example
 * toCamel('test_a') => 'testA'
 * toCamel('test/a', '/') => 'testA'
 */
export function toCamel(key: string, replaceStr = '_') {
    const reg = new RegExp(`${replaceStr}([a-z])`, 'ig')

    return key.replace(reg, (_, g1) => {
        return g1.toUpperCase()
    })
}
