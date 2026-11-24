package main

// #include <stdlib.h>
import "C"

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/anacrolix/missinggo/v2/filecache"
	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/storage"
)

var gate sync.Mutex
var current *session

type session struct {
	server *http.Server
	client *torrent.Client
	dir    string
}

func stop() {
	if current == nil {
		return
	}
	current.server.Close()
	current.client.Close()
	os.RemoveAll(current.dir)
	current = nil
}

//export StopStream
func StopStream() { gate.Lock(); defer gate.Unlock(); stop() }

//export OpenStream
func OpenStream(uri *C.char, idx C.int) *C.char {
	gate.Lock()
	defer gate.Unlock()
	stop()
	address, err := start(C.GoString(uri), int(idx))
	if err != nil {
		return C.CString("Error: " + err.Error())
	}
	return C.CString(address)
}
func start(magnet string, index int) (string, error) {
	spec, err := torrent.TorrentSpecFromMagnetUri(magnet)
	if err != nil {
		return "", err
	}
	dir, err := os.MkdirTemp("", "stremio-pieces-")
	if err != nil {
		return "", err
	}
	keep := false
	defer func() {
		if !keep {
			os.RemoveAll(dir)
		}
	}()
	cache, err := filecache.NewCache(dir)
	if err != nil {
		return "", err
	}
	cache.SetCapacity(128 << 20)
	cfg := torrent.NewDefaultClientConfig()
	cfg.DataDir = dir
	cfg.DefaultStorage = storage.NewResourcePieces(cache.AsResourceProvider())
	cfg.ListenPort = 0
	cfg.DisableIPv6 = true
	cfg.NoDefaultPortForwarding = true
	cfg.EstablishedConnsPerTorrent = 24
	cl, err := torrent.NewClient(cfg)
	if err != nil {
		return "", err
	}
	defer func() {
		if !keep {
			cl.Close()
		}
	}()
	t, _, err := cl.AddTorrentSpec(spec)
	if err != nil {
		return "", err
	}
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	token := make([]byte, 16)
	if _, err = rand.Read(token); err != nil {
		listener.Close()
		return "", err
	}
	path := "/" + hex.EncodeToString(token)
	server := &http.Server{ReadHeaderTimeout: 5 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != path || (r.Method != "GET" && r.Method != "HEAD") {
			http.NotFound(w, r)
			return
		}
		select {
		case <-t.GotInfo():
		case <-r.Context().Done():
			return
		case <-time.After(90 * time.Second):
			http.Error(w, "No peers provided metadata", 504)
			return
		}
		files := t.Files()
		selected := index
		if selected < 0 {
			var largest int64 = -1
			for i, f := range files {
				switch strings.ToLower(filepath.Ext(f.Path())) {
				case ".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v", ".ts":
					if f.Length() > largest {
						selected = i
						largest = f.Length()
					}
				}
			}
		}
		if selected < 0 || selected >= len(files) {
			http.Error(w, "Video file unavailable", 404)
			return
		}
		file := files[selected]
		reader := file.NewReader()
		defer reader.Close()
		reader.SetContext(r.Context())
		reader.SetReadahead(4 << 20)
		http.ServeContent(w, r, filepath.Base(file.Path()), time.Time{}, reader)
	})}
	current = &session{server, cl, dir}
	keep = true
	go server.Serve(listener)
	return fmt.Sprintf("http://%s%s", listener.Addr(), path), nil
}
func main() {}
