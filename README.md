#### 需求
验证码之所以存在，其实就是要区别出“人”和“机器”。特别的，对于滑动验证码，需要根据滑动的动作判断出操作者是人与否。这显然是与自动化测试是矛盾的
#### 分析
解决这个问题的关键点在于两点：  
- 准确地识别出验证码需要滑到的位置
- 以符合人类规律的形式把滑块滑到正确的位置  

**识别过程分为三步（重点）：**
- 识别拖动终点地址
- 拖动
- 验证结果并区别对待
#### 实现
执行程序
```
(async () => {
    if (browser) {
        return;
    }

    // 配置窗口
    browser = await puppeteer.launch({
        "headless": false,
        "args": ["--start-fullscreen"],
        "devtools": true,
        "executablePath": "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    });

    page = await browser.newPage();
    // 参数设置
    await configPage(page)
    // 打开浏览器并切换tab
    await toRightPage(page)
})();
```
参数设置
```
const configPage = async (page) => {
    await page.setViewport({ width: 1208, height: 1040});
}
```
拖动
```
const drag = async (page) => {
    // 通过计算色差取到终点
    await page.waitFor(2000)
    let canvas_bg = await page.evaluate(() => {
       return getCanvasValue('canvas.geetest_canvas_bg')
    })
    let canvas_fullbg = await page.evaluate(() => {
       return getCanvasValue('canvas.geetest_canvas_fullbg')
    })
    let dest = _getLeftest(_differentSet(canvas_bg, canvas_fullbg))
    console.log(dest)

    // 找到滑动按钮，并计算位置拖动
    let slider = await page.$(".geetest_slider_button")
    let sliderInfo = await slider.boundingBox()
    let m = page.mouse
    await m.move(sliderInfo.x + 40, sliderInfo.y + 6)
    await m.down()


    // 模拟匀加速直线运动拖动
    let gen = _moveTrace(dest.x + 40)
    for (let ret of gen) {
        await m.move(sliderInfo.x + ret + Math.random(0.5), sliderInfo.y + Math.random(2))
    }
    await m.move(sliderInfo.x + dest.x + 36, sliderInfo.y + Math.random(2))

    await m.up()
    
    let isSuccess = await page.evaluate(_ => {
        if (!!document.querySelector(".geetest_success_animate")) {
            return true
        }
        return false
    })
    return isSuccess
}
```
新开页面并模拟用户操作
```
const toRightPage = async (page) => {
    await page.goto(URL)
    await page.evaluate(_ => {
        let rect = document.querySelector(".products-content").getBoundingClientRect()
        window.scrollTo(0, rect.top - 30)
    })
    await page.waitFor(1000)
    let tab = await page.$('.products-content li:nth-child(2)')
    await tab.click()
    await page.waitFor(5000)
    let btn = await page.$('#captcha')
    await btn.click()

    await page.mainFrame().addScriptTag({content: injectedScript})

    // 开始拖动
    let isSuccess = false
    while(!isSuccess){
        isSuccess = await drag(page)
    }
}
```
tool函数
```
// 获取cancas图片
const injectedScript = `
    const getCanvasValue = (selector) => {
        let canvas = document.querySelector(selector)

        let ctx = canvas.getContext('2d')
        let [width, height] = [canvas.width, canvas.height]

        // 每个像素点比较
        let rets = [...Array(height)].map(_ => [...Array(width)].map(_ => 0))
        for (let i = 0; i < height; ++i) {
            for (let j = 0; j < width; ++j) {
                rets[i][j] = Object.values(ctx.getImageData(j,i,1,1).data)
            }
        }

        return rets
    }
`

const THRESHOLD = 70

const _equals = (a, b) => {
    if (a.length !== b.length) {
        return false
    }

    for (let i = 0; i < a.length; ++i) {
        let delta = Math.abs(a[i] - b[i])

        if (delta > THRESHOLD) {
            return false
        }
    }
    return true
}

const _differentSet = (a1, a2) => {
    let rets = []

    a1.forEach((el, y) => {
        el.forEach((el2, x) => {
            if (!_equals(el2, a2[y][x])) {
                rets.push({
                    x,
                    y,
                    v: el2,
                    v2: a2[y][x]
                })
            }
        })
    })

    return rets
}

const _getLeftest = (array) => {
    return array.sort((a, b) => {
        if (a.x < b.x) {
            return -1
        }

        else if (a.x == b.x) {
            if (a.y <= b.y) {
                return -1
            }
            return 1
        }

        return 1
    }).shift()
}

// 模拟匀加速直线运动
let _moveTrace = function* (dis){
    let trace = []
    let t1 = 2
    let curr = 0
    let step = 0
    let a = 2

    while (curr < dis) {
        let t = t0 * (++step)
        curr = parseFloat((1 / 2 * a * t * t).toFixed(2))

        trace.push(curr)
    }

    for (let i = 0; i < trace.length; ++i) {
        yield trace[i]
    }

}
```
#### 问题
- 校验时出现“拼图被怪兽吃掉了”提示失败, 可以选择加大加速度以及添加上下左右的偏移量模拟真实性
- 使用`page.waitFor(selector)`获取不到对应元素，可以使用`page.$(selector)`代替
- 对于上下文操作需要放在`page.evaluate`函数内