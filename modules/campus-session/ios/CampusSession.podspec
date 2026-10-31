Pod::Spec.new do |s|
  s.name = 'CampusSession'
  s.version = '1.0.0'
  s.summary = 'Clear this app WebKit session on unbind'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Campus Timetable'
  s.homepage = 'https://expo.dev'
  s.platforms = { :ios => '16.4' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
