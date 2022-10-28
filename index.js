const puppeteer = require('puppeteer')
const URL = "https://www.jianshu.com/u/40909ea33e50"

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

// 打开浏览器并切换tab
const toRightPage = async (page) => {
    // 导航到某个页面
    await page.goto(URL)

    await page.waitFor(1000)
    // 在浏览器中执行一段 JavaScript 代码
    await page.evaluate(_ => {
        const rect = document.querySelector(".g-bd").getBoundingClientRect()
        window.scrollTo(0, rect.top - 30)
    })

    // 点击切换tab
    const tab = await page.$('.tcapt-tabs__container li:nth-child(2)')
    await tab.click()

    await page.waitFor(1000)

    // 点击验证按钮
    const btn = await page.$('.yidun_intelli-icon')
    await btn.click()

    await page.waitFor(5000)

    // 在主页面中插入js片段
    await page.mainFrame().addScriptTag({content: injectedScript})
}