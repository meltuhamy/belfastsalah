# Adds ios/App/App/PrayerRemindersPlugin.swift to the App target's sources.
#
#   gem install xcodeproj && ruby scripts/ios/add-reminders-plugin.rb
#
# The project file is committed with this already applied; the script is kept
# so that the change is reproducible and reviewable rather than a wall of
# generated pbxproj. Running it again is a no-op.

require "xcodeproj"

PROJECT = File.expand_path("../../ios/App/App.xcodeproj", __dir__)
FILE = "PrayerRemindersPlugin.swift"

project = Xcodeproj::Project.open(PROJECT)
app = project.targets.find { |t| t.name == "App" } or abort "No App target"
group = project.main_group.children.find { |g| g.display_name == "App" } or abort "No App group"

if group.files.any? { |f| f.path == FILE }
  puts "#{FILE} is already in the App target"
else
  ref = group.new_file(FILE)
  app.source_build_phase.add_file_reference(ref)
  project.save
  puts "Added #{FILE} to the App target"
end
