require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'RichFlow'
  s.version = package['version']
  s.summary = 'Native continuous rich text flows for React Native'
  s.description = package['description']
  s.license = { :type => 'MIT', :file => '../LICENSE' }
  s.authors = 'huamurui'
  s.homepage = 'https://github.com/huamurui/react-native-rich-flow'
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/huamurui/react-native-rich-flow.git', :tag => "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Swift imports SDWebImage directly. Expo enables modular headers for direct
  # dependencies, including in hosts that use static libraries without frameworks.
  s.dependency 'SDWebImage', '~> 5.21.0'
  s.dependency 'SDWebImageSVGCoder', '~> 1.7.0'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
