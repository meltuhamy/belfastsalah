# Adds the PreviewCapture UI test target, and a scheme that runs it, to the
# Xcode project.
#
#   gem install xcodeproj && ruby scripts/ios/add-preview-capture-target.rb
#
# The project file is committed with this already applied; the script is kept
# so that the change is reproducible and reviewable rather than a wall of
# generated pbxproj. Running it again is a no-op.
#
# A separate scheme rather than a testable in App's, so that ordinary builds
# and the release archive never compile or run it. See
# .github/workflows/previews.yml for what it is for.

require "xcodeproj"

PROJECT = File.expand_path("../../ios/App/App.xcodeproj", __dir__)
NAME = "PreviewCapture"

project = Xcodeproj::Project.open(PROJECT)

if project.targets.any? { |t| t.name == NAME }
  puts "#{NAME} is already in the project."
  exit 0
end

app = project.targets.find { |t| t.name == "App" } or abort "No App target"
team = app.build_configurations.first.build_settings["DEVELOPMENT_TEAM"]

target = project.new_target(:ui_test_bundle, NAME, :ios, "15.0")
target.add_dependency(app)

# new_target links Foundation by a path into whichever SDK this machine has,
# which breaks as soon as Xcode moves on. XCTest links what it needs itself.
target.frameworks_build_phase.files.to_a.each(&:remove_from_project)
project.frameworks_group.recursive_children.each(&:remove_from_project)
project.frameworks_group.remove_from_project

group = project.main_group.new_group(NAME, NAME)
source = group.new_file("PreviewCapture.swift")
target.add_file_references([source])

target.build_configurations.each do |config|
  config.build_settings.merge!(
    "PRODUCT_BUNDLE_IDENTIFIER" => "com.meltuhamy.londonsalah.PreviewCapture",
    "PRODUCT_NAME" => "$(TARGET_NAME)",
    "TEST_TARGET_NAME" => app.name,
    "GENERATE_INFOPLIST_FILE" => "YES",
    "SWIFT_VERSION" => "5.0",
    "TARGETED_DEVICE_FAMILY" => "1,2",
    "CODE_SIGN_STYLE" => "Automatic",
    "DEVELOPMENT_TEAM" => team
  )
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(PROJECT, NAME, true)

puts "Added #{NAME}."
