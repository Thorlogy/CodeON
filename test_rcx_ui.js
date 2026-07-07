const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.stack || error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

    await page.setViewport({ width: 1440, height: 900 });
    
    console.log("Navigating to http://localhost:1999...");
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Wait for group selection cards
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("Selecting LEGO group...");
    await page.evaluate(() => {
        // Find Lego card
        const cards = Array.from(document.querySelectorAll('.card, [id^="card-"]'));
        const legoCard = cards.find(c => c.textContent.toLowerCase().includes('lego') || c.id === 'card-lego');
        if (legoCard) {
            legoCard.click();
            console.log("Clicked LEGO card");
        } else {
            // Fallback click first visible card
            const firstCard = document.querySelector('.card');
            if (firstCard) {
                firstCard.click();
                console.log("Clicked first visible card as fallback");
            } else {
                console.log("No card found");
            }
        }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("Clicking Lego RCX card natively...");
    const element = await page.evaluateHandle(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const rcxCard = elements.find(el => {
            const children = Array.from(el.childNodes);
            return children.some(node => node.nodeType === 3 && node.textContent.trim() === 'Lego RCX');
        });
        return rcxCard ? rcxCard.closest('.card-view') || rcxCard : null;
    });

    if (element.asElement()) {
        await element.asElement().click();
        console.log("Clicked Lego RCX card element natively");
    } else {
        console.log("Lego RCX card not found natively!");
    }

    await new Promise(resolve => setTimeout(resolve, 6000));

    console.log("Taking screenshot of the workspace...");
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/d594f8c7-4dfc-4d17-b4d9-36059cc03cc2/test_rcx_ui.png' });
    console.log("Screenshot saved to test_rcx_ui.png!");
    
    await browser.close();
})();
