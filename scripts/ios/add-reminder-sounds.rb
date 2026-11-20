# Adds the adhan notification sounds (ios/App/App/Sounds/adhan-N.caf) to the
# App target's resources.
#
#   gem install xcodeproj && ruby scripts/ios/add-reminder-sounds.rb
#
# The project file is committed with this already applied; the script is kept
# so that the change is reproducible and reviewable rather than a wall of
# generated pbxproj. Running it again is a no-op, and adds any new file.
#
# Each file is its own reference, not a folder reference, so it is copied to
# the root of the app bundle. That is where UNNotificationSound(named:) looks;
# a sound inside a folder in the bundle is never found and plays the default.

require "xcodeproj"

PROJECT = File.expand_path("../../ios/App/App.xcodeproj", __dir__)
SOUNDS_DIR = File.expand_path("../../ios/App/App/Sounds", __dir__)

project = Xcodeproj::Project.open(PROJECT)
app = project.targets.find { |t| t.name == "App" } or abort "No App target"
app_group = project.main_group.children.find { |g| g.display_name == "App" } or abort "No App group"
group = app_group.children.find { |g| g.display_name == "Sounds" } ||
        app_group.new_group("Sounds", "Sounds")

added = 0
Dir.children(SOUNDS_DIR).select { |f| f.end_with?(".caf") }.sort.each do |name|
  next if group.files.any? { |f| f.path == name }
  ref = group.new_file(name)
  app.resources_build_phase.add_file_reference(ref)
  added += 1
end

project.save
puts added.zero? ? "The sounds are already in the project." : "Added #{added} sound(s)."
