from flask import Flask, render_template
from models.database import init_db
from routes.admin_routes import admin_bp
from routes.card_routes import card_bp

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

app.register_blueprint(admin_bp)
app.register_blueprint(card_bp)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
