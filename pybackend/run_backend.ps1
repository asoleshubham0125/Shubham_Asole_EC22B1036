python -m pip install -r requirements.txt
 $env:MONGODB_DB='gemscap'
python -m uvicorn pybackend.server:app --host 0.0.0.0 --port 8080

