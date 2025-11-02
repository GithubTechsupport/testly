import os
import sys
from pathlib import Path
from flask import Flask, jsonify
from dotenv import load_dotenv

# Ensure we can import from src/
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.upload_embed_api import upload_bp
from scripts.exam_generation_api import exam_bp

load_dotenv()

def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify(status="ok"), 200

    @app.get("/ready")
    def ready():
        return jsonify(status="ready"), 200

    # Versioned API with modular blueprints
    app.register_blueprint(upload_bp, url_prefix="/api/v1/pipelines")
    app.register_blueprint(exam_bp, url_prefix="/api/v1/pipelines")
    return app

app = create_app()

if __name__ == "__main__":
    # Windows-friendly dev run: python scripts\api_server.py
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", os.getenv("PORT"))), debug=True)