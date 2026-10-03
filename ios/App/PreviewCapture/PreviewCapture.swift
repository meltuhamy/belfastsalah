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
        XCTAssertTrue(app.webViews.buttons["Done"].waitForExistence(timeout: 30))
        settle()
        capture("app-setup")
    }

    func test2Light() {
        captureMainScreens(theme: "light")
    }

    func test3Dark() {
        captureMainScreens(theme: "dark")
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
