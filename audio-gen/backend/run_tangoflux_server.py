#!/usr/bin/env python3
"""
Run script for TangoFlux audio generation server.
Starts the Flask API server on port 7861.
"""

import os
import sys

# Add the TangoFlux directory to the Python path
tangoflux_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'TangoFlux')
if tangoflux_path not in sys.path:
    sys.path.insert(0, tangoflux_path)

# Add the backend directory to the Python path
backend_path = os.path.dirname(os.path.abspath(__file__))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

if __name__ == '__main__':
    from tangoflux_server import app
    port = int(os.environ.get('PORT', 7861))
    print(f"Starting TangoFlux API server on port {port}")
    print(f"TangoFlux path: {tangoflux_path}")
    app.run(host='0.0.0.0', port=port, debug=False)
