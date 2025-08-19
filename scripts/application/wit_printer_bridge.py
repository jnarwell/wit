#!/usr/bin/env python3
"""
W.I.T. Printer Bridge
====================

A bridge service that enables full printer control from W.I.T. by translating
commands to printer-specific protocols.

Usage:
    python wit_printer_bridge.py --printer-id YOUR_PRINTER_ID

For PrusaLink:
    python wit_printer_bridge.py \
        --printer-id M1755224055771 \
        --printer-url http://192.168.1.131 \
        --printer-user maker \
        --printer-pass YOUR_PASSWORD
"""

import asyncio
import json
import logging
import time
import argparse
import os
import sys
from typing import Dict, Any, Optional
from datetime import datetime
import aiohttp
import websockets
from aiohttp import BasicAuth
import requests
from requests.auth import HTTPDigestAuth

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more detailed logs
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('bridge.log')
    ]
)
logger = logging.getLogger(__name__)

class PrinterBridge:
    """Bridge between W.I.T. and printer"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.printer_id = config['printer_id']
        self.wit_url = config['wit_server']
        self.printer_url = config['printer_url']
        self.printer_user = config.get('printer_user', 'maker')
        self.printer_pass = config.get('printer_pass', '')
        
        self.ws = None
        self.running = True
        self.last_status = {}
        self.command_queue = asyncio.Queue()
        
        # G-code command mapping
        self.command_map = {
            'SET_NOZZLE_TEMPERATURE': self._set_nozzle_temp,
            'SET_HEATBED_TEMPERATURE': self._set_bed_temp,
            'HOME': self._home_axes,
            'MOVE': self._move_axes,
            'EMERGENCY_STOP': self._emergency_stop,
            'PAUSE': self._pause_print,
            'RESUME': self._resume_print,
            'CANCEL': self._cancel_print,
            'SEND_GCODE': self._send_gcode
        }
        
    async def start(self):
        """Start the bridge"""
        logger.info(f"Starting W.I.T. Printer Bridge for {self.printer_id}")
        logger.info(f"W.I.T. Server: {self.wit_url}")
        logger.info(f"Printer URL: {self.printer_url}")
        
        # Test printer connection first
        logger.info("Testing printer connection...")
        test_status = await self._get_printer_status()
        if test_status and test_status.get('connected'):
            logger.info("✓ Successfully connected to printer")
        else:
            logger.error("✗ Failed to connect to printer - check URL and password")
            logger.error(f"Status: {test_status}")
            return
        
        # Create tasks for different bridge functions
        tasks = [
            asyncio.create_task(self._connect_to_wit()),
            asyncio.create_task(self._status_updater()),
            asyncio.create_task(self._command_processor()),
            asyncio.create_task(self._heartbeat_sender())
        ]
        
        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            logger.info("Bridge shutting down...")
            self.running = False
            
    async def _connect_to_wit(self):
        """Connect to W.I.T. WebSocket"""
        ws_url = self.wit_url.replace('http://', 'ws://').replace('https://', 'wss://')
        ws_url = f"{ws_url}/ws/printer-bridge/{self.printer_id}"
        
        while self.running:
            try:
                logger.info(f"Connecting to W.I.T. at {ws_url}")
                
                async with websockets.connect(ws_url) as websocket:
                    self.ws = websocket
                    logger.info("Connected to W.I.T.")
                    
                    # Wait for registration acknowledgment
                    msg = await websocket.recv()
                    data = json.loads(msg)
                    if data.get('type') == 'registration_ack':
                        logger.info("Registration acknowledged by W.I.T.")
                    
                    # Listen for commands
                    while self.running:
                        try:
                            msg = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                            data = json.loads(msg)
                            logger.debug(f"Received message from W.I.T.: {data}")
                            
                            if data.get('type') == 'command':
                                logger.info(f"Received command: {data.get('command')} with kwargs: {data.get('kwargs')}")
                                await self.command_queue.put(data)
                            elif data.get('type') == 'heartbeat_ack':
                                logger.debug("Heartbeat acknowledged")
                                
                        except asyncio.TimeoutError:
                            continue
                        except websockets.exceptions.ConnectionClosed:
                            logger.warning("W.I.T. connection closed")
                            break
                            
            except Exception as e:
                logger.error(f"W.I.T. connection error: {e}")
                await asyncio.sleep(5)  # Reconnect delay
                
    async def _status_updater(self):
        """Periodically fetch and send printer status"""
        while self.running:
            try:
                status = await self._get_printer_status()
                if status and self.ws and self.ws.state.name == 'OPEN':
                    await self.ws.send(json.dumps({
                        'type': 'status_update',
                        'status': status
                    }))
                    self.last_status = status
                    
            except Exception as e:
                logger.error(f"Status update error: {e}")
                
            await asyncio.sleep(5)  # Update every 5 seconds
            
    async def _command_processor(self):
        """Process commands from queue"""
        while self.running:
            try:
                # Wait for command with timeout
                command_data = await asyncio.wait_for(
                    self.command_queue.get(), 
                    timeout=1.0
                )
                
                command = command_data.get('command')
                kwargs = command_data.get('kwargs', {})
                command_id = command_data.get('id')
                
                logger.info(f"Processing command: {command} with {kwargs}")
                
                # Execute command
                success = False
                if command in self.command_map:
                    success = await self.command_map[command](kwargs)
                else:
                    logger.warning(f"Unknown command: {command}")
                
                # Send response
                if self.ws and self.ws.state.name == 'OPEN':
                    await self.ws.send(json.dumps({
                        'type': 'command_response',
                        'command_id': command_id,
                        'success': success,
                        'command': command
                    }))
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Command processing error: {e}")
                
    async def _heartbeat_sender(self):
        """Send periodic heartbeats"""
        while self.running:
            try:
                if self.ws and self.ws.state.name == 'OPEN':
                    await self.ws.send(json.dumps({
                        'type': 'heartbeat',
                        'timestamp': datetime.now().isoformat()
                    }))
            except:
                pass
                
            await asyncio.sleep(30)  # Heartbeat every 30 seconds
            
    async def _get_printer_status(self) -> Dict[str, Any]:
        """Get current printer status"""
        try:
            # Use requests for proper HTTP Digest authentication
            url = f"{self.printer_url}/api/v1/status"
            auth = HTTPDigestAuth(self.printer_user, self.printer_pass)
            
            # Run in executor to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: requests.get(url, auth=auth, timeout=5)
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Transform to W.I.T. format
                status = {
                    'state': data.get('printer', {}).get('state', 'Unknown'),
                    'connected': True,
                    'temperatures': {
                        'nozzle': {
                            'current': data.get('temperature', {}).get('tool0', {}).get('actual', 0),
                            'target': data.get('temperature', {}).get('tool0', {}).get('target', 0)
                        },
                        'bed': {
                            'current': data.get('temperature', {}).get('bed', {}).get('actual', 0),
                            'target': data.get('temperature', {}).get('bed', {}).get('target', 0)
                        }
                    }
                }
                
                # Add job info if printing
                job = data.get('job')
                if job:
                    status['job'] = {
                        'name': job.get('file', {}).get('display_name', 'Unknown'),
                        'progress': job.get('progress', 0)
                    }
                    
                return status
            else:
                logger.warning(f"Printer returned status code: {response.status_code}")
                return {'connected': False, 'state': 'Auth Error'}
                        
        except Exception as e:
            logger.error(f"Failed to get printer status: {e}")
            return {'connected': False, 'state': 'Error', 'error': str(e)}
            
    async def _send_gcode(self, kwargs: Dict[str, Any]) -> bool:
        """Send G-code to printer via PrusaLink API v1"""
        gcode = kwargs.get('gcode', kwargs.get('command'))
        if not gcode:
            return False
            
        logger.info(f"Sending G-code: {gcode}")
        
        try:
            # PrusaLink requires uploading a .gcode file and then optionally printing it
            auth = HTTPDigestAuth(self.printer_user, self.printer_pass)
            loop = asyncio.get_event_loop()
            
            # Create G-code content
            gcode_content = f"; WIT Bridge Command\n{gcode}\n"
            
            # Use PrusaLink API v1 endpoint
            upload_url = f"{self.printer_url}/api/v1/files/local/wit_temp.gcode"
            
            try:
                # First upload the file with PUT request
                logger.debug(f"Uploading G-code to {upload_url}")
                
                # For temperature commands, we don't want to start a print job
                # Just upload the file and PrusaLink will execute it
                headers = {
                    'Content-Type': 'text/x.gcode',
                    'Overwrite': '1',  # Overwrite if exists
                    'Print-After-Upload': '1'  # Execute immediately
                }
                
                response = await loop.run_in_executor(
                    None,
                    lambda: requests.put(
                        upload_url,
                        data=gcode_content.encode('utf-8'),
                        auth=auth,
                        headers=headers,
                        timeout=10
                    )
                )
                
                logger.debug(f"Response: {response.status_code}")
                if response.status_code in [200, 201, 204]:
                    logger.info(f"G-code '{gcode}' uploaded and executed successfully")
                    return True
                else:
                    logger.warning(f"Failed to upload G-code: {response.status_code}")
                    logger.debug(f"Response body: {response.text[:200]}")
                    
                    # Try without Print-After-Upload header
                    headers.pop('Print-After-Upload', None)
                    response = await loop.run_in_executor(
                        None,
                        lambda: requests.put(
                            upload_url,
                            data=gcode_content.encode('utf-8'),
                            auth=auth,
                            headers=headers,
                            timeout=10
                        )
                    )
                    
                    if response.status_code in [200, 201, 204]:
                        logger.info(f"G-code uploaded, attempting to print...")
                        
                        # Now start the print
                        print_url = f"{self.printer_url}/api/v1/files/local/wit_temp.gcode"
                        response = await loop.run_in_executor(
                            None,
                            lambda: requests.post(
                                print_url,
                                auth=auth,
                                timeout=10
                            )
                        )
                        
                        if response.status_code in [200, 201, 204, 409]:  # 409 if already printing
                            logger.info(f"G-code execution started")
                            return True
                    
            except Exception as e:
                logger.error(f"Failed to send G-code: {e}")
            
            logger.warning("Failed to send G-code via PrusaLink API")
            return False
            
        except Exception as e:
            logger.error(f"G-code send error: {e}")
            return False
            
    async def _set_nozzle_temp(self, kwargs: Dict[str, Any]) -> bool:
        """Set nozzle temperature"""
        temp = kwargs.get('nozzle_temperature', 0)
        extruder = kwargs.get('extruder', '0')
        
        # Validate temperature
        if temp < 0 or temp > 250:
            logger.error(f"Invalid nozzle temperature: {temp}")
            return False
            
        gcode = f"M104 S{temp}"
        if extruder != '0':
            gcode = f"T{extruder} {gcode}"
            
        return await self._send_gcode({'gcode': gcode})
        
    async def _set_bed_temp(self, kwargs: Dict[str, Any]) -> bool:
        """Set bed temperature"""
        temp = kwargs.get('bed_temperature', 0)
        
        # Validate temperature
        if temp < 0 or temp > 100:
            logger.error(f"Invalid bed temperature: {temp}")
            return False
            
        gcode = f"M140 S{temp}"
        return await self._send_gcode({'gcode': gcode})
        
    async def _home_axes(self, kwargs: Dict[str, Any]) -> bool:
        """Home printer axes"""
        axes = kwargs.get('axis', 'XYZ')
        gcode = f"G28 {axes}"
        return await self._send_gcode({'gcode': gcode})
        
    async def _move_axes(self, kwargs: Dict[str, Any]) -> bool:
        """Move printer axes"""
        parts = []
        
        if 'x' in kwargs:
            parts.append(f"X{kwargs['x']}")
        if 'y' in kwargs:
            parts.append(f"Y{kwargs['y']}")
        if 'z' in kwargs:
            parts.append(f"Z{kwargs['z']}")
            
        if parts:
            gcode = f"G0 {' '.join(parts)}"
            if 'speed' in kwargs:
                gcode += f" F{kwargs['speed']}"
            return await self._send_gcode({'gcode': gcode})
            
        return False
        
    async def _emergency_stop(self, kwargs: Dict[str, Any]) -> bool:
        """Emergency stop"""
        return await self._send_gcode({'gcode': 'M112'})
        
    async def _pause_print(self, kwargs: Dict[str, Any]) -> bool:
        """Pause print"""
        return await self._send_gcode({'gcode': 'M601'})
        
    async def _resume_print(self, kwargs: Dict[str, Any]) -> bool:
        """Resume print"""
        return await self._send_gcode({'gcode': 'M602'})
        
    async def _cancel_print(self, kwargs: Dict[str, Any]) -> bool:
        """Cancel print"""
        return await self._send_gcode({'gcode': 'M603'})

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='W.I.T. Printer Bridge')
    
    # Required arguments
    parser.add_argument('--printer-id', required=True, help='Printer ID from W.I.T.')
    
    # Server settings
    parser.add_argument('--wit-server', default='http://localhost:8000', 
                       help='W.I.T. server URL (default: http://localhost:8000)')
    
    # Printer settings
    parser.add_argument('--printer-url', default='http://192.168.1.131',
                       help='Printer URL (default: http://192.168.1.131)')
    parser.add_argument('--printer-user', default='maker',
                       help='Printer username (default: maker)')
    parser.add_argument('--printer-pass', default='',
                       help='Printer password')
    
    # Bridge settings
    parser.add_argument('--log-level', default='INFO',
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Log level (default: INFO)')
    
    args = parser.parse_args()
    
    # Configure logging
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # Build config
    config = {
        'printer_id': args.printer_id,
        'wit_server': args.wit_server,
        'printer_url': args.printer_url,
        'printer_user': args.printer_user,
        'printer_pass': args.printer_pass
    }
    
    # Create and start bridge
    bridge = PrinterBridge(config)
    
    try:
        asyncio.run(bridge.start())
    except KeyboardInterrupt:
        logger.info("Bridge stopped by user")

if __name__ == '__main__':
    main()