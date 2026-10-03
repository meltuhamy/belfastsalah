# Adds the home screen widgets to the Xcode project: the PrayerWidgets
# extension, the plugin the app hands it data through, the App Group both
# share, and the PrayerWidgetsTests target with its scheme.
#
#   gem install xcodeproj && ruby scripts/ios/add-widget-targets.rb
#
# The project file is committed with this already applied; the script is kept
# so the change is reproducible and reviewable rather than a wall of generated
# pbxproj. Running it again is a no-op.

require "xcodeproj"

PROJECT = File.expand_path("../../ios/App/App.xcodeproj", __dir__)
EXTENSION = "PrayerWidgets"
TESTS = "PrayerWidgetsTests"
APP_GROUP_ENTITLEMENTS = "App/App.entitlements"

project = Xcodeproj::Project.open(PROJECT)

if project.targets.any? { |t| t.name == EXTENSION }
  puts "#{EXTENSION} is already in the project."
  exit 0
end

app = project.targets.find { |t| t.name == "App" } or abort "No App target"
app_settings = app.build_configurations.first.build_settings
team = app_settings["DEVELOPMENT_TEAM"]
marketing_version = app_settings["MARKETING_VERSION"]
build_number = app_settings["CURRENT_PROJECT_VERSION"]

# new_target links Foundation by a path into whichever SDK this machine has,
# which breaks as soon as Xcode moves on. Swift links what it imports itself.
def drop_sdk_frameworks(project, target)
  target.frameworks_build_phase.files.to_a.each(&:remove_from_project)
  project.frameworks_group.recursive_children.each(&:remove_from_project)
end

def common_settings(team)
  {
    "SWIFT_VERSION" => "5.0",
    "TARGETED_DEVICE_FAMILY" => "1,2",
    "CODE_SIGN_STYLE" => "Automatic",
    "DEVELOPMENT_TEAM" => team,
    "GENERATE_INFOPLIST_FILE" => "YES",
    "PRODUCT_NAME" => "$(TARGET_NAME)",
  }
end

# --- Shared code: the App Group store, used by the app, widget and tests.

shared_group = project.main_group.new_group("Shared", "Shared")
store = shared_group.new_file("WidgetStore.swift")

# --- The app: the plugin, what registers it, and the App Group.

app_group = project.main_group.children.find { |g| g.display_name == "App" }
plugin = app_group.new_file("PrayerWidgetPlugin.swift")
controller = app_group.new_file("MainViewController.swift")
app_group.new_file("App.entitlements")
app.add_file_references([plugin, controller, store])
app.build_configurations.each do |config|
  config.build_settings["CODE_SIGN_ENTITLEMENTS"] = APP_GROUP_ENTITLEMENTS
end

# --- The widget extension.

extension = project.new_target(:app_extension, EXTENSION, :ios, "17.0")
drop_sdk_frameworks(project, extension)

widget_group = project.main_group.new_group(EXTENSION, EXTENSION)
widget_sources = %w[
  PrayerWidgetsBundle.swift
  PrayerWidgetIntents.swift
  PrayerTimelineProvider.swift
  PrayerTimeline.swift
  PrayerWidgetView.swift
  FitProbe.swift
  WidgetPayload.swift
  WidgetSettings.swift
].map { |name| widget_group.new_file(name) }
widget_group.new_file("Info.plist")
widget_group.new_file("PrayerWidgets.entitlements")
extension.add_file_references(widget_sources + [store])

extension.build_configurations.each do |config|
  config.build_settings.merge!(common_settings(team)).merge!(
    "PRODUCT_BUNDLE_IDENTIFIER" => "com.meltuhamy.londonsalah.widgets",
    "INFOPLIST_FILE" => "PrayerWidgets/Info.plist",
    "INFOPLIST_KEY_CFBundleDisplayName" => "Prayer Times",
    "CODE_SIGN_ENTITLEMENTS" => "PrayerWidgets/PrayerWidgets.entitlements",
    # An extension's version has to match the app it ships in.
    "MARKETING_VERSION" => marketing_version,
    "CURRENT_PROJECT_VERSION" => build_number,
    "SKIP_INSTALL" => "YES",
    "APPLICATION_EXTENSION_API_ONLY" => "YES",
    "LD_RUNPATH_SEARCH_PATHS" => "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"
  )
end

# The app carries the extension inside it, in PlugIns/.
app.add_dependency(extension)
embed = app.new_copy_files_build_phase("Embed Foundation Extensions")
embed.dst_subfolder_spec = "13"
embed.add_file_reference(extension.product_reference, true)
  .settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

# --- The tests: hosted by the app, so they run with its App Group.

tests = project.new_target(:unit_test_bundle, TESTS, :ios, "17.0")
drop_sdk_frameworks(project, tests)
project.frameworks_group.remove_from_project if project.frameworks_group.children.empty?
tests.add_dependency(app)

tests_group = project.main_group.new_group(TESTS, TESTS)
test_sources = %w[
  Support.swift
  WidgetPayloadTests.swift
  PrayerTimelineTests.swift
  AppGroupTests.swift
  WidgetSnapshotTests.swift
  WidgetFitTests.swift
].map { |name| tests_group.new_file(name) }
# Everything of the widget's but its @main, which only one module may have.
tests.add_file_references(test_sources + widget_sources.reject { |f| f.path == "PrayerWidgetsBundle.swift" } + [store])

# The payloads src/lib/widgetPayload.fixture.test.ts writes, as a folder.
# Relative to the project's directory, not the group's, which is a level down.
fixtures = tests_group.new_reference("../../fixtures/widget-payload", :project)
fixtures.last_known_file_type = "folder"
fixtures.name = "widget-payload"
tests.resources_build_phase.add_file_reference(fixtures)

tests.build_configurations.each do |config|
  config.build_settings.merge!(common_settings(team)).merge!(
    "PRODUCT_BUNDLE_IDENTIFIER" => "com.meltuhamy.londonsalah.PrayerWidgetsTests",
    "TEST_HOST" => "$(BUILT_PRODUCTS_DIR)/App.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/App",
    "BUNDLE_LOADER" => "$(TEST_HOST)"
  )
end

# swift-snapshot-testing, for the tests only.
package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
package.repositoryURL = "https://github.com/pointfreeco/swift-snapshot-testing"
package.requirement = { "kind" => "upToNextMajorVersion", "minimumVersion" => "1.18.0" }
project.root_object.package_references << package
product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
product.package = package
product.product_name = "SnapshotTesting"
tests.package_product_dependencies << product
build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
build_file.product_ref = product
tests.frameworks_build_phase.files << build_file

project.save

# A scheme of their own, so App's builds and archives never compile the
# tests or fetch the snapshot package.
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(tests)
scheme.set_launch_target(app)
scheme.save_as(PROJECT, TESTS, true)

puts "Added #{EXTENSION} and #{TESTS}."
