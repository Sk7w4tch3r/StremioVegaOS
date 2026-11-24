module.exports = {
    dependency: {
        platforms: {
            kepler: {
                "autolink": {
                    "TorrentEngine": {
                        "libraryName": "libTorrentEngine.so",
                        "linkDynamic": true,
                        "provider": "application",
                        "components": [],
                        "turbomodules": [
                            "TorrentEngine"
                        ]
                    }
                }
            },
        },
    },
};