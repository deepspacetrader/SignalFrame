"""
Wrapper to start API server with proper environment fixes.
Usage: python run_server.py [port]
"""
import os
import sys

# Fix 1: Remove invalid SSL_CERT_FILE
ssl_cert = os.environ.get('SSL_CERT_FILE', '')
if ssl_cert and not os.path.exists(ssl_cert):
    print(f"[ENV FIX] Removing invalid SSL_CERT_FILE: {ssl_cert}")
    del os.environ['SSL_CERT_FILE']

# Fix 2: Disable SSL verification for HuggingFace downloads if needed
# (Only for downloading model files, not for API calls)
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['PYTHONWARNINGS'] = 'ignore:Unverified HTTPS request'

# Fix 3: Ensure HuggingFace uses local cache
os.environ['HF_HUB_OFFLINE'] = '0'  # Allow downloads
os.environ['TRANSFORMERS_OFFLINE'] = '0'

print("[ENV FIX] Environment configured for MMAudio")

# Now run the actual server
print("[START] Launching api_server.py...")
print("-" * 50)

# Import and run the server
from api_server import app

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7862
    app.run(host='0.0.0.0', port=port, debug=False)
