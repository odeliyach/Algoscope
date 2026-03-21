.PHONY: install run-api run-dashboard test lint clean

install:
	pip install -r requirements.txt

run-api:
	uvicorn app.main:app --reload --port 8000

run-dashboard:
	streamlit run dashboard.py

test:
	python -m pytest tests/ -v --tb=short

lint:
	ruff check app/ dashboard.py tests/

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -f algoscope.db
