import XCTest

/**
 * Screenshots of the real app on a simulator, for the preview comment on pull
 * requests. Not a test: nothing here asserts anything about the app, and a
 * screen that cannot be reached is simply missing from the comment.
 *
 * Run by .github/workflows/previews.yml, which sets PREVIEW_DIR (passed in as
 * TEST_RUNNER_PREVIEW_DIR) to where the images go. The simulator runs on the
 * same machine, so this writes to that path directly.
 *
 * Settings are handed to the app as launch arguments rather than by tapping
 * through setup. @capacitor/preferences reads UserDefaults.standard under
 * "CapacitorStorage.<key>", and "-key value" arguments land in UserDefaults'
 * argument domain, which wins over anything stored. So every launch starts
 * from exactly the settings it names, whatever an earlier launch saved.
 *
 * XCTest runs the methods alphabetically, which is the order they appear in.
 */
final class PreviewCapture: XCTestCase {

    private var outputDir: URL!

    override func setUpWithError() throws {
        guard let dir = ProcessInfo.processInfo.environment["PREVIEW_DIR"], !dir.isEmpty else {
            throw XCTSkip("PREVIEW_DIR is not set; this only runs from the previews workflow.")
        }
        outputDir = URL(fileURLWithPath: dir, isDirectory: true)
        try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)
        continueAfterFailure = false
    }

    func test1Setup() {
        // An empty string reads as no settings at all, so this is first launch.
        let app = launch(settings: "")
        // Longer than the rest: this is the first launch on a fresh simulator.
        XCTAssertTrue(app.webViews.buttons["Done"].waitForExistence(timeout: 60))
        settle()
        capture("app-setup")
    }

    func test2Light() {
        captureMainScreens(theme: "light")
    }

    func test3Dark() {
        captureMainScreens(theme: "dark")
    }

    /**
     * The home screen widgets, added the way a person adds them: edit mode,
     * the widget gallery, search, pick a size, Add Widget. Then the Edit
     * Widget sheet for one of them.
     *
     * This drives SpringBoard, whose wording and layout are Apple's and move
     * between iOS versions, so every step looks for what it needs under a few
     * names, and a step that cannot find it prints the whole screen's
     * accessibility tree to the log before giving up - that is what to read
     * when these images go missing. test2 has already launched the app with
     * London settings, which is what wrote the widgets' payload.
     */
    func test4HomeScreenWidgets() throws {
        for (index, size) in ["small", "medium", "large"].enumerated() {
            try addWidget(page: index, size: size)
        }
        tapIfPresent(springboard.buttons["Done"])
        try require(showOurWidgets(), "our widgets on any home screen page")
        capture("home-widgets")
    }

    func test5EditWidget() throws {
        let widget = try require(showOurWidgets(), "a widget of ours on the home screen")
        widget.press(forDuration: 1.5)
        try require(springboard.buttons["Edit Widget"], "Edit Widget in the menu").tap()
        // The sheet animates in and shows a spinner while it asks the
        // extension for its options; wait for one of them to be on screen.
        let option = springboard.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS 'Countdown'")).firstMatch
        if !option.waitForExistence(timeout: 15) {
            print("PreviewCapture: Edit Widget showed no options. The screen was:\n\(springboard.debugDescription)")
        }
        Thread.sleep(forTimeInterval: 1.5)
        capture("edit-widget")
        XCUIDevice.shared.press(.home)
    }

    private let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    private func addWidget(page: Int, size: String) throws {
        XCUIDevice.shared.press(.home)
        settle()

        // Edit mode: touch and hold an empty part of the home screen.
        springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.93))
            .press(forDuration: 2)
        // iOS 18 on has an Edit menu with Add Widget in it; 17 had a "+".
        if !tapIfPresent(springboard.buttons["Add Widget"], timeout: 2) {
            if tapIfPresent(springboard.buttons["Edit"], timeout: 3) {
                try require(springboard.buttons["Add Widget"], "Add Widget in the Edit menu").tap()
            } else {
                try require(springboard.buttons["Add"], "an Edit or + button in edit mode").tap()
            }
        }

        let search = springboard.searchFields.firstMatch
        try require(search, "the widget gallery's search field").tap()
        search.typeText("Prayer")
        Thread.sleep(forTimeInterval: 1)
        if page == 0 {
            // Once, for whoever next has to adjust these steps to a new iOS.
            print("PreviewCapture: the widget gallery after searching:\n\(springboard.debugDescription)")
        }
        // Not the app's icon, which is also on screen behind the gallery
        // with the same label: tapping that one closes the gallery.
        let app = springboard.descendants(matching: .any)
            .matching(NSPredicate(
                format: "label == 'Prayer Times' AND elementType != %d",
                XCUIElement.ElementType.icon.rawValue
            )).firstMatch
        try require(app, "Prayer Times in the gallery").tap()
        Thread.sleep(forTimeInterval: 1.5)

        // The sizes are pages of a horizontal scroll view, smallest first,
        // each a button labelled with the app and widget names and valued
        // "Widget, Small" and so on. Swipe on that, not the whole sheet.
        let preview = springboard.buttons
            .matching(NSPredicate(format: "label BEGINSWITH 'Prayer Times,'")).firstMatch
        try require(preview, "the widget's preview in the gallery")
        for _ in 0..<page {
            preview.swipeLeft()
            Thread.sleep(forTimeInterval: 0.8)
        }
        print("PreviewCapture: adding \(size), the gallery shows \(String(describing: preview.value))")
        // Its label starts with an icon glyph - " Add Widget" - so not an
        // exact match.
        let add = springboard.buttons
            .matching(NSPredicate(format: "label ENDSWITH 'Add Widget'")).firstMatch
        try require(add, "Add Widget for the \(size) size").tap()
        Thread.sleep(forTimeInterval: 2)
    }

    /**
     * Goes to the home screen page our widgets are on and returns one of
     * them. SpringBoard lists every page's icons at once, the off-screen ones
     * with empty frames, and a placed widget is an icon carrying the app's
     * name with the value "Widget" - so swipe until one is on screen.
     */
    private func showOurWidgets() -> XCUIElement {
        XCUIDevice.shared.press(.home)
        settle()
        let ours = springboard.icons.matching(NSPredicate(
            format: "identifier == 'Prayer Times' AND value BEGINSWITH 'Widget'"
        ))
        for _ in 0..<4 {
            if let onScreen = ours.allElementsBoundByIndex.first(where: { $0.isHittable }) {
                return onScreen
            }
            springboard.swipeLeft()
            settle()
        }
        // Not found: a query that matches nothing, for require() to report.
        return ours.matching(NSPredicate(value: false)).firstMatch
    }

    /** The element, once it exists; or the screen's tree in the log, and a failure. */
    @discardableResult
    private func require(_ element: XCUIElement, _ what: String, timeout: TimeInterval = 8) throws -> XCUIElement {
        if element.waitForExistence(timeout: timeout) {
            return element
        }
        print("PreviewCapture could not find \(what). The screen was:\n\(springboard.debugDescription)")
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "missing: \(what)"
        shot.lifetime = .keepAlways
        add(shot)
        throw XCTSkip("Could not find \(what)")
    }

    @discardableResult
    private func tapIfPresent(_ element: XCUIElement, timeout: TimeInterval = 2) -> Bool {
        guard element.waitForExistence(timeout: timeout) else { return false }
        element.tap()
        return true
    }

    private func captureMainScreens(theme: String) {
        let app = launch(settings: settingsJSON(theme: theme))
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.staticTexts["Fajr"].waitForExistence(timeout: 30))
        settle()
        capture("app-today-\(theme)")

        // Light only: the month table looks the same in both, and one fewer
        // swipe is one fewer thing to go wrong.
        if theme == "light" {
            web.swipeUp(velocity: .slow)
            settle()
            capture("app-month-\(theme)")
            web.swipeDown(velocity: .fast)
            settle()
        }

        web.links["Settings"].tap()
        XCTAssertTrue(web.links["Home"].waitForExistence(timeout: 10))
        settle()
        capture("app-settings-\(theme)")
    }

    /**
     * The settings a returning London user would have. The time zone notice
     * is marked as answered so that it does not cover the screen - the
     * simulator follows the runner's zone, which the workflow sets to London
     * anyway, so it would not appear.
     */
    private func settingsJSON(theme: String) -> String {
        """
        {"notify":false,"notifyMinutes":5,"asrMethod":"shafi","theme":"\(theme)",\
        "location":"london","showTimesInDeviceZone":false,"timeZoneNoticeSeen":true}
        """
    }

    private func launch(settings: String) -> XCUIApplication {
        let app = XCUIApplication()
        // The argument domain parses its values as property lists, so the
        // JSON goes in as a quoted plist string rather than bare - bare, its
        // braces would be read as a dictionary.
        let quoted = "\"" + settings
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"") + "\""
        app.launchArguments = ["-CapacitorStorage.settings", quoted]
        app.launch()
        // The splash screen stays up for three seconds (capacitor.config.ts),
        // over a web view that is already accessible underneath it.
        Thread.sleep(forTimeInterval: 3.5)
        return app
    }

    /** Lets the splash screen, page transitions and scrolling come to rest. */
    private func settle() {
        Thread.sleep(forTimeInterval: 1.5)
    }

    private func capture(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        do {
            try screenshot.pngRepresentation.write(
                to: outputDir.appendingPathComponent("\(name).png")
            )
        } catch {
            XCTFail("Could not write \(name).png: \(error)")
        }
    }
}
