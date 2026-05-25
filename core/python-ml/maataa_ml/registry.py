MODEL_REGISTRY = {
    "whisper": {"path": "offline-models/audio/whisper", "status": "placeholder"},
    "vision": {"path": "offline-models/vision", "status": "placeholder"},
    "ocr": {"path": "offline-models/ocr", "status": "placeholder"},
    "embeddings": {"path": "offline-models/embeddings", "status": "placeholder"},
    "script-matrices": {
        "path": "core/python-ml/maataa_ml/script_matrices.py",
        "status": "local-thread-pool",
        "scripts": ["brahmi", "kharosthi", "siddham"],
    },
}
