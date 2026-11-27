# JM Reader 维护文档

单文件静态漫画阅读器：输入章节图片 ID，连续滚动或单页阅读，自动还原 JM 的切片打乱图，页数来自官方 API，API 与图片域名都支持失败自动切换。

- 入口文件：`index.html`
- 无构建、无后端、无框架（只引 Bootstrap 5 CSS）
- 目标浏览器：现代 Chromium / Edge（用到 `IntersectionObserver`、`AbortController`、`canvas.toBlob("image/webp")`、`URL.createObjectURL`）

---

## 1. 快速开始

1. 打开 `index.html`（本地 `file://` 或任意静态托管均可）。
2. 输入章节图片 ID，例如 `1224005`，点「阅读」。
3. 默认「连续滚动」；切到「单页」后底部出现上一页/下一页。

输入框也接受：
- 完整图片地址（正则提取 `/photos/<id>` 里的数字）
- 含数字的任意文本（取第一段两位以上数字）

> 输入的是**章节图片 ID**，也就是 `/media/photos/<id>/` 里那串数字。单行本的作品 ID 通常等于它；多章节作品每一话有独立 ID，作品 ID 不能直接用。

---

## 2. 目录与部署

```
index.html      # 全部代码（HTML + CSS + JS）
README.md        # 本文档
```

直接静态托管即可，没有构建步骤。Bootstrap 只用了 CSS：

```html
https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css
备用：https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.3.3/css/bootstrap.min.css
```

CSS 加载失败时退化为无样式页面，功能仍可用（折叠/按钮样式会变）。

---

## 3. 整体结构

```
顶部：ID 输入 / 视图选择 / 阅读按钮
中部：#reader
        ├─ #pages    连续滚动：每页一个 .page 容器
        └─ #single   单页：一个 <img> + 状态文字
底部：页码 / 总页数（单页模式多两个按钮）
```

两种视图共用同一份图片缓存，切换视图不会重新下载或重新解码。

数据流：

```
输入 ID
  → fetchChapterImages(aid)          取 images 数组（页数 + 文件名）
  → 建 N 个正方形占位 div
  → IntersectionObserver 懒加载
  → getPageImage(page)
       → loadImageWithHosts()         图片域名失败自动切换
       → decodeToCanvas()             切片倒序还原（需要时）
       → canvas.toBlob(webp, 0.95)    得到 blob URL
  → <img> 渲染
  → 滚动时按可见面积更新页码
  → 超过缓存上限时淘汰远页
```

---

## 4. 官方 API（取页数）

### 请求

```
GET https://www.cdnbtd.cc/chapter?id=<photo_id>&v=<unix_ts>
headers:
  token:      md5(<unix_ts> + "185Hcomic3PAPP7R")
  tokenparam: "<unix_ts>,2.1.13"
```

常量在代码里：

```js
const API_TOKEN_SECRET = "185Hcomic3PAPP7R";
const API_VERSION = "2.1.13";
```

### 响应

```json
{ "code": 200, "data": "<base64 密文>" }
```

解密步骤：

1. `data` 做 base64 解码。
2. AES-256-ECB 解密，key 为 `md5(<同一个 unix_ts> + "185Hcomic3PAPP7R")` 的 32 字节 ASCII。
3. 去掉 PKCS#7 填充。
4. `JSON.parse`，得到：

```js
{
  id, name, series, tags, series_id, images: ["00001.webp", ...],
  addtime, real_link, is_favorite, liked
}
```

- `images.length` 就是总页数。
- `images` 里的文件名直接用于拼图片地址（不假设一定是 5 位序号）。

代码位置：`fetchChapterImages()` + `AES.decryptEcb()`。

### CORS

官方 API 会：
- `Access-Control-Allow-Origin` 回显请求的 Origin（`file://` 下回显 `null`）
- 预检允许 `Token`、`Tokenparam` 头

所以静态页面能直接 `fetch`。如果换的新域名不支持 CORS，浏览器会直接失败，需要换域名或加代理。

### 域名与失败切换

```js
const API_HOSTS = [
  "https://www.cdnbtd.cc",
  "https://www.cdnutc.cc",
  "https://www.cdngwc.net",
  "https://www.cdngwc.club",
];
```

- 按顺序尝试，单域名 8 秒超时（`AbortController`）。
- 成功后记住 `apiHost`，下次优先使用（只在当前页面会话内，不持久化）。
- 全部失败：页面显示「获取页数失败」，不会退回逐页探测。

---

## 5. 图片解码（切片还原）

### 是否打乱

```js
function getNum(aid, filename) {
  if (aid < 220980) return 0;        // 旧作品：没有打乱
  if (aid < 268850) return 10;
  const x = aid < 421926 ? 10 : 8;
  const digest = md5(String(aid) + filename);
  return (digest.charCodeAt(31) % x) * 2 + 2;
}
```

- `filename` 是去掉扩展名的页码（`00001.webp` → `00001`）。
- 阈值/公式来自 `jmcomic` 库（`JmImageTool.get_num`）。
- `scramble_id` 理论上应从作品页面 HTML 的 `var scramble_id = ...` 取，但该 HTML 接口没有 CORS，浏览器取不到，所以旧作品统一按默认阈值 `220980` 处理。

### 还原

把图横向切成 `num` 条，**倒序**拼回，`over = h % num` 补到第一条：

```js
const over = h % num;
for (let i = 0; i < num; i++) {
  let move = Math.floor(h / num);
  const ySrc = h - move * (i + 1) - over;
  let yDst = move * i;
  if (i === 0) move += over;
  else yDst += over;
  ctx.drawImage(img, 0, ySrc, w, move, 0, yDst, w, move);
}
```

- 解码画在 `<canvas>` 上，再 `toBlob("image/webp", 0.95)`。
- 图片 `<img>` 必须带 `crossOrigin="anonymous"`，且 CDN 返回 `Access-Control-Allow-Origin`；否则 canvas 被污染，`toBlob` 会失败。
- `num === 0` 的页不经过 canvas，直接用 CDN 原图 URL。

---

## 6. 图片域名与失败切换

```js
const IMAGE_HOSTS = [
  "https://cdn-msp3.jmapiproxy1.cc/media/photos/",
  "https://cdn-msp2.jmapiproxy1.cc/media/photos/",
  "https://cdn-msp.jmapiproxy3.cc/media/photos/",
  "https://cdn-msp.jmapiproxy1.cc/media/photos/",
  "https://cdn-msp2.jmdanjonproxy.vip/media/photos/",
  "https://cdn-msp12.jmdanjonproxy.xyz/media/photos/",
  "https://cdn-msp3.jmapiproxy3.cc/media/photos/",
];
```

`loadImageWithHosts(aid, name)`：

- 从 `imageHost`（上次成功的下标）开始，失败依次尝试下一个，成功后更新 `imageHost`。
- 全部失败：该页显示「加载失败」；滚出再滚回来（或切视图）会重新尝试。
- 图片域名没有超时控制，依赖浏览器的图片加载失败。

---

## 7. 视图与交互

### 连续滚动（默认）

- `#reader` 是滚动容器，`#pages` 最大宽度 860px 居中。
- 每页先渲染成正方形占位 `div`（`aspect-ratio: 1/1`），图片加载后改成真实宽高比。
- 懒加载：`IntersectionObserver`，`rootMargin: "100% 0px"`，进入视口前后各一屏开始加载。
- 页码：滚动时用 `requestAnimationFrame` 计算每页与视口的重叠面积，取最大的一页。
- 输入：原生滚轮 / 触屏滑动。没有键盘翻页、没有点击左右区域。

### 单页

- 只显示当前页，`#single` 最大宽度 860px，图片按容器等比缩放。
- 底部显示「上一页 / 页码 / 下一页」，首页/末页自动禁用。
- 翻页只改 `state.cur`，不涉及滚动位置。
- 加载完成后预取下一页。

### 视图切换

- 滚动 → 单页：取当前可见页，显示它。
- 单页 → 滚动：滚到当前页位置，并主动加载当前页 ±1；同时清掉 `#singleImg` 的 `src` 释放隐藏位图。

---

## 8. 缓存与内存

### 两层结构

```js
state.meta       // page -> { w, h }，永不淘汰，用于淘汰后保持 aspect-ratio
state.imageCache // page -> { url, revoke, size }，参与淘汰
state.imageLoading // page -> Promise，防并发重复加载
```

- 解码页：`url` 是 WebP blob URL，`revoke: true`，`size` 是 `blob.size`。
- 未解码页：`url` 是 CDN 原图地址，`revoke: false`，`size: 0`。
- 淘汰时把 `meta` 的宽高写回容器，所以页面高度不变、滚动不跳。

### 上限与淘汰

```js
const CACHE_MAX_PAGES = 30;
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const KEEP_BACK = 8;
const KEEP_AHEAD = 12;
```

`maybeEvict()`：

- 保留窗口：`cur - 8` ~ `cur + 12`。
- 不淘汰：当前页、正在加载的页。
- 只有超过 30 页或 64 MB 才淘汰。
- 淘汰顺序：离当前页最远的优先。
- 淘汰动作：先 `block.replaceChildren()` 移除 `<img>`，再 `revokeObjectURL`，最后删缓存项。

触发点：每页加载完成、当前页变化、单页加载完成、视图切换。

### 已知边界

- 保留窗口内的页即使总量超过 64 MB 也不会被淘汰。
- 64 MB 只统计 blob，不统计浏览器里已解码的位图；DOM 中的图片数量由缓存页数间接限制。
- 快速长距离滚动时，中间页可能没有进入过视口而保持占位，滚回去才会加载。

---

## 9. 状态与函数索引

### `state`

| 字段           | 说明                   |
| -------------- | ---------------------- |
| `aid`          | 当前章节图片 ID        |
| `images`       | API 返回的文件名数组   |
| `mode`         | `scroll` / `page`      |
| `blocks`       | `.page` DOM 数组       |
| `imageCache`   | 图片缓存               |
| `imageLoading` | 加载中的 Promise       |
| `meta`         | 页码 → 宽高            |
| `observer`     | IntersectionObserver   |
| `cur`          | 当前页                 |
| `seq`          | 作品加载序号（防串台） |
| `singleSeq`    | 单页渲染序号           |

### 主要函数

| 函数                            | 作用                              |
| ------------------------------- | --------------------------------- |
| `md5(str)`                      | MD5，用于 API token 和切片数      |
| `AES.decryptEcb(bytes, key)`    | AES-256-ECB 解密                  |
| `getNum(aid, filename)`         | 计算切片数，0 表示不还原          |
| `decodeToCanvas(img, num)`      | 切片倒序还原                      |
| `fetchChapterImages(aid)`       | 调官方 API、解密、返回 images     |
| `loadImageWithHosts(aid, name)` | 图片域名轮询                      |
| `getPageImage(page)`            | 取图（缓存 / 下载 / 解码 / blob） |
| `loadPage(page, block)`         | 滚动模式渲染单页                  |
| `showSingle(page)`              | 单页模式渲染                      |
| `maybeEvict()`                  | 缓存淘汰                          |
| `updateCurrentPage()`           | 可见面积最大页作为当前页          |
| `start()`                       | 阅读入口                          |

---

## 10. 已知限制

1. **依赖 JM 的私有 API**：`APP_VERSION`、`APP_TOKEN_SECRET`、加密方式、`/chapter` 路径都可能随 App 更新变化。
2. **镜像域名写死**：失效需要手动更新 `API_HOSTS` / `IMAGE_HOSTS`。
3. **`scramble_id` 是近似值**：无法从浏览器读取真实值，旧作品按 `220980` 处理；如果 JM 调整规则，图片会还原错误。
4. **强依赖 CORS**：API 和图片 CDN 都必须允许跨域；新域名不支持 CORS 时页面无法工作。
5. **无持久化**：刷新后输入、视图、分流记忆全部重置（图片/API 域名只记在内存）。
6. **无导出/下载**：blob 只在内存里。
7. **无 RTL / 双页模式**：只有连续滚动和单页两种视图。
8. **WebP 0.95 有损**：文字漫画基本无损，但不等于原图。
9. **Bootstrap CDN 依赖**：加载失败会失去样式（功能不受影响）。
10. **单页模式没有滚轮翻页**：只能点底部按钮。

---

## 11. 维护指南

### 换 API 域名

改 `API_HOSTS` 数组，保持顺序即优先级。新域名必须：

- 支持 `/chapter?id=<id>&v=<ts>`
- 返回 `{"code":200,"data":"..."}`
- 允许 CORS 预检头 `Token`、`Tokenparam`
- 接受相同的 token 算法

### 换图片域名

改 `IMAGE_HOSTS`，路径格式必须是 `<域名>/media/photos/`。域名必须返回 `Access-Control-Allow-Origin`，否则 canvas 无法 `toBlob`。

### App 版本 / 密钥更新

从 `jmcomic` 库的 `jm_config.py` 取最新值：

```python
APP_VERSION = "2.1.13"
APP_TOKEN_SECRET = "185Hcomic3PAPP7R"
```

同步改 `API_VERSION` 和 `API_TOKEN_SECRET`。`APP_DATA_SECRET` 目前与 `APP_TOKEN_SECRET` 相同。

### 调整缓存

改 `CACHE_MAX_PAGES`、`CACHE_MAX_BYTES`、`KEEP_BACK`、`KEEP_AHEAD`。改大更流畅但更吃内存；改小更容易重新加载。

### 新增视图

1. `#reader` 下加容器，CSS 用 `body.view-xxx` 控制显隐。
2. `viewSelect` 加 `<option>`。
3. `viewSelect` 的 change 里分支处理，复用 `getPageImage`。
4. 切换时保证 `state.cur` 连续。

### 调试

- 控制台看 `state` 不方便（都在闭包里），可在关键函数临时 `console.log`。
- Network 面板过滤 `chapter` 可看 API 请求头/响应；`media/photos` 可看图片域名。
- 图片花屏/错位：先确认 `aid`、`num`、文件名是否正确，再用单独的 Python 脚本按同样算法解一遍对比。

---

## 12. 测试清单

| 用例              | 预期                                |
| ----------------- | ----------------------------------- |
| `1224005`         | 31 页；第 1 页切片 14，正常还原     |
| `10000`           | 25 页；旧作品不还原，直接显示原图   |
| `1479098` 第 3 页 | 960×746 横图，切片 8，正常还原      |
| 连续滚动到底      | 页码到 `31 / 31`，无失败请求        |
| 滚动回顶部        | 页码回 `1 / 31`，被淘汰的页重新加载 |
| 单页模式翻页      | 页码变化，首/末页按钮禁用正确       |
| 单页 ↔ 滚动切换   | 保持当前页，不重新下载已缓存页      |
| 屏蔽首个 API 域名 | 自动切到下一个域名，仍能取到页数    |
| 屏蔽首个图片域名  | 自动切到下一个域名，图片仍能加载    |
| 输入非法 ID       | 不发起请求，输入框保持焦点          |

---

## 13. 安全与合规

- 这是第三方阅读器，内容来自外部站点；请自行确认使用场景与当地法规。
- `APP_TOKEN_SECRET` 是客户端公开常量，不是服务端密钥；不要把它当成安全边界。
- 页面不收集、不上传任何用户数据；所有请求直接发往 JM 的 API 和 CDN。
- 没有持久化，不会在本地留下阅读记录。
