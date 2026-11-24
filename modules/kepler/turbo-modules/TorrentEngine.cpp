#include "TorrentEngine.h"
#include <cstdlib>
#include <memory>
extern "C" char* OpenStream(char*, int);
extern "C" void StopStream();
namespace TorrentEngineTurboModule {
TorrentEngine::TorrentEngine() = default;
TorrentEngine::~TorrentEngine() noexcept { StopStream(); }
std::string TorrentEngine::openStream(std::string magnet, double fileIndex) {
  std::unique_ptr<char, decltype(&std::free)> result(OpenStream(magnet.data(), static_cast<int>(fileIndex)), std::free);
  return result ? std::string(result.get()) : "Error: Unable to start local playback";
}
void TorrentEngine::stopStream() { StopStream(); }
}
