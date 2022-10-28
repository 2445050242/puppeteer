const puppeteer = require('puppeteer')
const URL = "https://auth.geetest.com/login/"

let browser
let page

// 执行
(async () => {
    if (browser) {
        return
    }

    // 配置窗口
    browser = await puppeteer.launch({
        // 是否显示浏览器
        "headless": false,
        // 配置参数
        "args": ["--start-fullscreen"],
        // 是否打开控制台
        "devtools": true,
        // chrome启动路径
        "executablePath": "C:/Users/4399/AppData/Local/Google/Chrome/Application/chrome.exe"
    })

    page = await browser.newPage()
    await configPage(page)
    await toRightPage(page)
})()

//参数设置
const configPage = async (page) => {
    await page.setViewport({ width: 1208, height: 1040})
}

// 拖动
const drag = async (page) => {
    // 通过计算色差取到终点
    await page.waitFor(2000)
    let canvas_bg = await page.evaluate(() => {
       return getCanvasValue('canvas.geetest_canvas_slice')
    })
    let canvas_fullbg = await page.evaluate(() => {
       return getCanvasValue('canvas.geetest_canvas_bg')
    })
    let dest = _getLeftest(_differentSet(canvas_bg, canvas_fullbg))
    console.log(dest)

    // 找到滑动按钮，并计算位置拖动
    let slider = await page.$(".geetest_slider_button")
    // 获取的是圆钮左上角的坐标，需要适当的往内部移几个像素，否则鼠标“抓”不到圆钮
    let sliderInfo = await slider.boundingBox()
    // 模拟鼠标移动到指定位置并按下
    let m = page.mouse
    await m.move(sliderInfo.x + 40, sliderInfo.y + 6)
    await m.down()

    // 模拟匀加速直线运动拖动
    let gen = _moveTrace(dest.x + 40)
    for (let ret of gen) {
        await m.move(sliderInfo.x + ret + Math.random(0.5), sliderInfo.y + ret + Math.random(10))
    }

    // 等待移动到指定位置并放开
    await m.move(sliderInfo.x + dest.x + 36, sliderInfo.y +  Math.random(10))
    await m.up()
    
    // 判断是否成功，若不成功则再次重复刚刚的操作
    let isSuccess = await page.evaluate(_ => {
        // 可以通过检测页面中是否出现成功的元素来判断
        if (!!document.querySelector(".geetest_success_animate")) {
            return true
        }
        return false
    })
    return isSuccess
}

// 打开浏览器并切换tab
const toRightPage = async (page) => {
    let isSuccess = false
    // 导航到某个页面
    await page.goto(URL)

    await page.waitFor(1000)
    // 在浏览器中执行一段 JavaScript 代码
    await page.evaluate(_ => {
        let rect = document.querySelector(".content-outter").getBoundingClientRect()
        window.scrollTo(0, rect.top - 30)
    })

    await page.screenshot({
        path: './temp/login.png'
    })

    // 输入邮箱
    await page.type('.ivu-input', '5454841544@qq.com', { delay: 100 })
    // 输入密码
    await page.type('.ivu-input[type="password"]', '6528744', { delay: 100 })

    // 点击验证码按钮
    let tab = await page.$('.geetest_wait')
    await tab.click()

    await page.evaluate(_ => {
        isSuccess = !!document.querySelector(".geetest_success_animate")
    })
    if (isSuccess) {
        console.log('验证成功')
    } else {
        // await page.waitFor(5000)
        // let btn = await page.$('#captcha')
        // await btn.click()

        // 在主页面中插入js片段
        await page.mainFrame().addScriptTag({content: injectedScript})

        // 开始拖动
        while(!isSuccess){
            isSuccess = await drag(page)
        }
    }
}

// tool函数
// 获取canvas颜色值
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

// 色差阀值
const THRESHOLD = 70

// 判断像素点色差是否在阀值之内
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

// 获取两个canvas之间差异的数组
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

// 获取差集的x最小值
const _getLeftest = (array) => {
    return array.sort((a, b) => {
        if (a.x < b.x) {
            return -1
        } else if (a.x == b.x) {
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
    let t0 = 0.2
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
