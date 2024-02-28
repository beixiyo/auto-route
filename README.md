# 自动生成路由配置，支持嵌套路由

> 如果你使用 *vite*，请使用 `https://www.npmjs.com/package/@jl-org/vite-auto-route`

## 安装
```bash
npm i @jl-org/auto-route
```

## 使用
```ts
import { genRoutes } from '@jl-org/auto-route'
import { resolve } from 'node:path'

/** 写入某个路径 */
genRoutes({
    writePath: resolve('src/route.ts'),
})

/** 读取路由对象 */
const routes = genRoutes()
```

## 参数

```ts
function genRoutes(opts?: Opts);

type Opts = {
    /** 要写入的路径 不填则返回一个路由数组 */
    writePath?: string
    /** 路由文件夹路径 默认 /src/views */
    rootPath?: string
    /** 写入格式化空格 */
    space?: 2 | 4
}
```

## 他能做什么？

**自动生成路由配置，支持：**

1. 嵌套路由
2. 路由守卫
3. 路由参数
4. 路由重定向
5. meta


## 文件结构例子

<pre>
根文件夹
|-- src
  |-- views
    |-- index.vue
    |-- meta.(ts | js)
    |-- about
      |-- index.vue
      |-- meta.(ts | js)
      |-- nestFloder
        |-- index.vue
        |-- meta.(ts | js)
</pre>

`/src/views/index.vue`，会作为路由的首页

`/src/views/about/index.vue`，会作为首页的子路由

*meta* 为可选项

## 我不想让 `src/views/index.vue` 作为首页怎么办？

当你可能需要 `/home` 作为首页，那么你可以进行如下配置

首先，`src/views/index.vue` 必须创建，你里面可以不写东西，比如
```html
<template></template>
```

创建 `src/views/meta.{j,t}s` 文件，里面写上重定向即可  
然后你就可以在 `src/views/home/index.vue` 编写你的首页了
```ts
export default {
    redirect: '/home',
}
```


## 如何传递 *meta* ？

**注意，meta文件里，不可以写参数类型，不可以写扩展运算符，因为是用`eval`转换的**

在同级目录下，创建一个 *meta.ts* | *meta.js* 文件

并默认导出一个对象，该对象包含了所有需要传递的 *meta* 信息。

## 如何使用嵌套路由 ？

在一个目录下，创建一个新的文件夹，里面包含 *index.vue* 文件即可

## 如果使用路由守卫？

在 *meta.ts* | *meta.js* 文件中，添加一个 *beforeEnter* 函数即可

建议写 *meta.js* ，因为 eval 转化的不允许使用 ts

*beforeEnter* 会被自动提取出来

## 如果使用 *redirect* ？

在 *meta.ts* | *meta.js* 文件中，添加一个 *redirect* 对象即可

*redirect* 会被自动提取出来

## 如何使用 *param* ？

路由参数，$ 代表可选参数
  - *about/[param]*
  - *about/[param$]*
  