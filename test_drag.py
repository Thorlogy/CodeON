from playwright.sync_api import sync_playwright
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    print("Navigating to mission.html...")
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.goto("http://localhost:8080/mission.html")
    page.wait_for_timeout(2000)
    
    print("Taking initial screenshot...")
    page.screenshot(path="test_drag_init.png")

    html = page.content()
    with open("test_drag_dom.html", "w") as f:
        f.write(html)
        
    rows = page.locator(".blocklyTreeRow").all()
    print(f"Found {len(rows)} tree rows in total.")
    for i, r in enumerate(rows):
        print(f"Row {i} classes: {r.get_attribute('class')} visible: {r.is_visible()}")

    print("Clicking first category via JS dispatch...")
    row_handle = page.locator(".blocklyTreeRow").nth(1)
    row_handle.evaluate("el => el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}))")
    page.wait_for_timeout(100)
    row_handle.evaluate("el => el.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}))")
    row_handle.evaluate("el => el.click()")
    
    page.wait_for_timeout(1500)
    
    print("Taking category open screenshot...")
    page.screenshot(path="test_drag_cat_open.png")

    # Check if blocks appeared in flyout
    blocks = page.locator(".blocklyFlyout .blocklyDraggable")
    count = blocks.count()
    print(f"Found {count} draggable blocks in flyout.")

    if count > 0:
        block = blocks.first
        box = block.bounding_box()
        print(f"Block bounding box: {box}")
        
        if box:
            print("Dragging block to workspace...")
            # Move to center of block
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.down()
            
            # Move to workspace area (e.g. 500, 300)
            page.mouse.move(500, 300, steps=10)
            page.mouse.up()
            
            page.wait_for_timeout(1000)
            page.screenshot(path="test_drag_after_drop.png")
            
            # Evaluate blocks in workspace
            ws_blocks = page.evaluate("Blockly.getMainWorkspace().getAllBlocks().length")
            print(f"Blocks in workspace after drop: {ws_blocks}")

    context.close()
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
