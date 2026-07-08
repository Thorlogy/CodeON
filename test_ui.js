const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log('Starting puppeteer...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    page.setDefaultTimeout(15000);
    
    console.log('Navigating to http://localhost:1999...');
    await page.goto('http://localhost:1999', { waitUntil: 'networkidle2' });
    
    console.log('Taking screenshot of initial load...');
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/1_initial.png' });
    
    console.log('Waiting for RCX logo...');
    const rcxFound = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (let el of elements) {
            if (el.innerText && el.innerText.toLowerCase().includes('rcx')) {
                el.click();
                return true;
            }
            if (el.getAttribute('data-type') === 'rcx') {
                el.click();
                return true;
            }
        }
        return false;
    });

    if (rcxFound) {
        console.log('Clicked RCX robot...');
    } else {
        console.log('Could not find RCX logo!');
        await browser.close();
        return;
    }
    
    console.log('Waiting for workspace to load after clicking RCX...');
    await new Promise(r => setTimeout(r, 3000)); // give it time to load the workspace
    
    console.log('Taking screenshot of workspace...');
    await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/2_workspace.png' });
    
    console.log('Clicking on left menu "Aktion"...');
    try {
        await page.evaluate(() => {
            const elements = document.querySelectorAll('.blocklyTreeLabel');
            for (let el of elements) {
                if (el.innerText && el.innerText.includes('Aktion')) {
                    el.click();
                    return;
                }
            }
        });
        console.log('Clicked Aktion.');
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/3_left_menu_clicked.png' });
    } catch (e) {
        console.log('Error clicking Aktion:', e.message);
    }
    
    console.log('Clicking on right menu (SIM button or similar)...');
    try {
        await page.evaluate(() => {
            let sim = document.getElementById('simButton');
            if (sim && sim.style.display !== 'none') {
                sim.click();
                return;
            }
            let info = document.getElementById('infoButton');
            if (info) {
                info.click();
                return;
            }
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: '/Users/tleimbach/.gemini/antigravity/brain/9c15ce8f-da6b-495e-b8e8-7318b0358861/4_right_menu_clicked.png' });
    } catch (e) {
        console.log('Error clicking right menu:', e.message);
    }
    
    // Check if there are any error popups
    console.log('Checking for error messages...');
    try {
        const errorMsg = await page.evaluate(() => {
            const el = document.querySelector('#message'); 
            return el ? el.innerText : null;
        });
        if (errorMsg) {
            console.log('Found error popup on screen:', errorMsg);
        }
    } catch (e) {
        // ignore
    }

    console.log('Done.');
    await browser.close();
})();
