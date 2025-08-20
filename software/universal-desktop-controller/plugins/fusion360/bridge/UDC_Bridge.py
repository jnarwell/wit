# UDC Bridge Add-in for Fusion 360
# This add-in runs inside Fusion 360 and provides HTTP API for external control

import adsk.core, adsk.fusion, adsk.cam, traceback
import json
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

# Global variables
app = adsk.core.Application.get()
ui = app.userInterface
handlers = []
server = None
server_thread = None
server_port = 8360

class UDCBridgeHandler(BaseHTTPRequestHandler):
    """HTTP request handler for UDC Bridge API"""
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            if self.path == '/health':
                self.send_health_check()
            elif self.path == '/status':
                self.send_status()
            elif self.path == '/api/projects':
                self.send_projects()
            else:
                self.send_error(404, 'Endpoint not found')
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_POST(self):
        """Handle POST requests for API commands"""
        try:
            if self.path == '/api/command':
                self.handle_api_command()
            else:
                self.send_error(404, 'Endpoint not found')
        except Exception as e:
            self.send_error(500, str(e))
    
    def send_health_check(self):
        """Send health check response"""
        response = {
            'status': 'healthy',
            'timestamp': int(time.time() * 1000),
            'fusion_version': app.version,
            'bridge_version': '1.0.0'
        }
        self.send_json_response(response)
    
    def send_status(self):
        """Send current Fusion 360 status"""
        try:
            design = adsk.fusion.Design.cast(app.activeProduct)
            active_document = app.activeDocument
            
            status = {
                'fusion_running': True,
                'active_document': active_document.name if active_document else None,
                'design_active': design is not None,
                'workspace': app.data.activeProject.name if app.data.activeProject else None,
                'user': app.data.activeHub.name if app.data.activeHub else None,
                'timeline_position': design.timeline.markerPosition if design else 0
            }
            
            self.send_json_response(status)
        except Exception as e:
            self.send_error(500, f'Failed to get status: {str(e)}')
    
    def send_projects(self):
        """Send list of available projects"""
        try:
            projects = []
            
            # Get projects from active hub
            if app.data.activeHub:
                data_projects = app.data.activeHub.dataProjects
                for i in range(data_projects.count):
                    project = data_projects.item(i)
                    projects.append({
                        'id': project.id,
                        'name': project.name,
                        'description': project.description,
                        'is_active': project == app.data.activeProject
                    })
            
            response = {
                'projects': projects,
                'active_project': app.data.activeProject.name if app.data.activeProject else None
            }
            
            self.send_json_response(response)
        except Exception as e:
            self.send_error(500, f'Failed to get projects: {str(e)}')
    
    def handle_api_command(self):
        """Handle API command requests"""
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            command = data.get('command')
            parameters = data.get('parameters', {})
            
            if not command:
                self.send_error(400, 'Command is required')
                return
            
            # Execute command
            result = self.execute_command(command, parameters)
            
            # Send response
            response = {
                'success': True,
                'command': command,
                'result': result,
                'timestamp': int(time.time() * 1000)
            }
            
            self.send_json_response(response)
            
        except Exception as e:
            error_response = {
                'success': False,
                'error': str(e),
                'timestamp': int(time.time() * 1000)
            }
            self.send_json_response(error_response, status_code=500)
    
    def execute_command(self, command, parameters):
        """Execute Fusion 360 API command"""
        
        if command == 'getProjects':
            return self.get_fusion_projects()
        
        elif command == 'openProject':
            return self.open_project(parameters)
        
        elif command == 'createProject':
            return self.create_project(parameters)
        
        elif command == 'executeScript':
            return self.execute_script(parameters)
        
        elif command == 'createModel':
            return self.create_model(parameters)
        
        elif command == 'setParameters':
            return self.set_parameters(parameters)
        
        elif command == 'getParameters':
            return self.get_parameters()
        
        elif command == 'exportModel':
            return self.export_model(parameters)
        
        elif command == 'generateToolpaths':
            return self.generate_toolpaths(parameters)
        
        elif command == 'runSimulation':
            return self.run_simulation(parameters)
        
        else:
            raise ValueError(f'Unknown command: {command}')
    
    def get_fusion_projects(self):
        """Get list of Fusion 360 projects"""
        projects = []
        
        if app.data.activeHub:
            data_projects = app.data.activeHub.dataProjects
            for i in range(data_projects.count):
                project = data_projects.item(i)
                projects.append({
                    'id': project.id,
                    'name': project.name,
                    'description': project.description,
                    'is_active': project == app.data.activeProject
                })
        
        return {'projects': projects}
    
    def open_project(self, parameters):
        """Open a Fusion 360 project"""
        project_id = parameters.get('projectId')
        project_name = parameters.get('projectName')
        
        if not project_id and not project_name:
            raise ValueError('Project ID or name is required')
        
        # Find and open project
        if app.data.activeHub:
            data_projects = app.data.activeHub.dataProjects
            for i in range(data_projects.count):
                project = data_projects.item(i)
                if (project_id and project.id == project_id) or \
                   (project_name and project.name == project_name):
                    app.data.activeProject = project
                    return {'success': True, 'project': project.name}
        
        raise ValueError('Project not found')
    
    def create_project(self, parameters):
        """Create a new Fusion 360 project"""
        project_name = parameters.get('projectName')
        template_type = parameters.get('templateType', 'default')
        
        if not project_name:
            raise ValueError('Project name is required')
        
        # Create new document
        doc = app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        doc.name = project_name
        
        return {
            'success': True,
            'project_name': project_name,
            'document_id': doc.id
        }
    
    def execute_script(self, parameters):
        """Execute Python script in Fusion 360"""
        script_code = parameters.get('scriptCode')
        
        if not script_code:
            raise ValueError('Script code is required')
        
        # Execute the script in current context
        try:
            # Create a safe execution environment
            exec_globals = {
                'app': app,
                'ui': ui,
                'adsk': adsk
            }
            
            exec(script_code, exec_globals)
            
            return {'success': True, 'message': 'Script executed successfully'}
        except Exception as e:
            raise ValueError(f'Script execution failed: {str(e)}')
    
    def create_model(self, parameters):
        """Create a parametric model"""
        model_type = parameters.get('modelType')
        model_params = parameters.get('parameters', {})
        
        if not model_type:
            raise ValueError('Model type is required')
        
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            raise ValueError('No active design')
        
        root_comp = design.rootComponent
        
        if model_type == 'box':
            return self.create_box(root_comp, model_params)
        elif model_type == 'cylinder':
            return self.create_cylinder(root_comp, model_params)
        elif model_type == 'sphere':
            return self.create_sphere(root_comp, model_params)
        else:
            raise ValueError(f'Unknown model type: {model_type}')
    
    def create_box(self, component, params):
        """Create a parametric box"""
        width = params.get('width', 10)
        height = params.get('height', 10)
        depth = params.get('depth', 10)
        
        # Create sketch on XY plane
        sketch = component.sketches.add(component.xYConstructionPlane)
        
        # Create rectangle
        lines = sketch.sketchCurves.sketchLines
        rect = lines.addTwoPointRectangle(
            adsk.core.Point3D.create(0, 0, 0),
            adsk.core.Point3D.create(width, height, 0)
        )
        
        # Create extrusion
        profile = sketch.profiles[0]
        extrudes = component.features.extrudeFeatures
        ext_input = extrudes.createInput(
            profile, 
            adsk.fusion.FeatureOperations.NewBodyFeatureOperation
        )
        ext_input.setDistanceExtent(False, adsk.core.ValueInput.createByReal(depth))
        
        extrude = extrudes.add(ext_input)
        
        return {
            'success': True,
            'model_type': 'box',
            'dimensions': {'width': width, 'height': height, 'depth': depth},
            'feature_id': extrude.id
        }
    
    def set_parameters(self, parameters):
        """Set design parameters"""
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            raise ValueError('No active design')
        
        user_params = design.userParameters
        results = []
        
        for param_name, param_value in parameters.items():
            try:
                param = user_params.itemByName(param_name)
                if param:
                    param.expression = str(param_value)
                    results.append({'name': param_name, 'value': param_value, 'success': True})
                else:
                    # Create new parameter
                    user_params.add(param_name, adsk.core.ValueInput.createByReal(float(param_value)), '', '')
                    results.append({'name': param_name, 'value': param_value, 'success': True, 'created': True})
            except Exception as e:
                results.append({'name': param_name, 'value': param_value, 'success': False, 'error': str(e)})
        
        return {'parameters': results}
    
    def get_parameters(self):
        """Get current design parameters"""
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            raise ValueError('No active design')
        
        user_params = design.userParameters
        parameters = []
        
        for i in range(user_params.count):
            param = user_params.item(i)
            parameters.append({
                'name': param.name,
                'expression': param.expression,
                'value': param.value,
                'units': param.unit,
                'comment': param.comment
            })
        
        return {'parameters': parameters}
    
    def export_model(self, parameters):
        """Export model to various formats"""
        format_type = parameters.get('format')
        file_path = parameters.get('filePath')
        
        if not format_type or not file_path:
            raise ValueError('Format and file path are required')
        
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            raise ValueError('No active design')
        
        if format_type.lower() == 'stl':
            return self.export_stl(design, file_path, parameters.get('options', {}))
        elif format_type.lower() == 'step':
            return self.export_step(design, file_path, parameters.get('options', {}))
        else:
            raise ValueError(f'Unsupported format: {format_type}')
    
    def export_stl(self, design, file_path, options):
        """Export as STL file"""
        stl_export_options = app.exportManager.createSTLExportOptions(design.rootComponent)
        stl_export_options.filename = file_path
        stl_export_options.meshRefinement = options.get('meshRefinement', adsk.fusion.MeshRefinementSettings.MeshRefinementMedium)
        
        app.exportManager.execute(stl_export_options)
        
        return {'success': True, 'format': 'STL', 'file_path': file_path}
    
    def export_step(self, design, file_path, options):
        """Export as STEP file"""
        step_export_options = app.exportManager.createSTEPExportOptions(design.rootComponent)
        step_export_options.filename = file_path
        
        app.exportManager.execute(step_export_options)
        
        return {'success': True, 'format': 'STEP', 'file_path': file_path}
    
    def generate_toolpaths(self, parameters):
        """Generate CAM toolpaths"""
        # This is a complex operation that would require CAM workspace
        # For now, return a placeholder
        return {
            'success': True,
            'message': 'Toolpath generation not yet implemented',
            'setup': parameters.get('setupName')
        }
    
    def run_simulation(self, parameters):
        """Run simulation analysis"""
        # This would require Simulation workspace
        # For now, return a placeholder
        return {
            'success': True,
            'message': 'Simulation not yet implemented',
            'type': parameters.get('simulationType')
        }
    
    def send_json_response(self, data, status_code=200):
        """Send JSON response"""
        response_data = json.dumps(data, indent=2)
        
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response_data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        self.wfile.write(response_data.encode('utf-8'))

def start_server(port=8360):
    """Start the HTTP server"""
    global server, server_thread
    
    try:
        server = HTTPServer(('localhost', port), UDCBridgeHandler)
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()
        
        ui.messageBox(f'UDC Bridge server started on port {port}')
        return True
    except Exception as e:
        ui.messageBox(f'Failed to start UDC Bridge server: {str(e)}')
        return False

def stop_server():
    """Stop the HTTP server"""
    global server, server_thread
    
    if server:
        server.shutdown()
        server = None
    
    if server_thread:
        server_thread.join(timeout=2)
        server_thread = None

def run(context):
    """Main entry point for the add-in"""
    try:
        # Start the HTTP server
        start_server(server_port)
        
        # Create command definition
        cmd_def = ui.commandDefinitions.addButtonDefinition(
            'UDCBridgeStart', 
            'Start UDC Bridge', 
            'Start the UDC Bridge HTTP server'
        )
        
        # Add command to UI
        addins_panel = ui.allToolbarPanels.itemById('SolidScriptsAddinsPanel')
        if addins_panel:
            addins_panel.controls.addCommand(cmd_def)
        
    except:
        if ui:
            ui.messageBox('Failed to initialize UDC Bridge:\n{}'.format(traceback.format_exc()))

def stop(context):
    """Cleanup when add-in stops"""
    try:
        stop_server()
        
        # Clean up UI
        addins_panel = ui.allToolbarPanels.itemById('SolidScriptsAddinsPanel')
        if addins_panel:
            cmd_def = ui.commandDefinitions.itemById('UDCBridgeStart')
            if cmd_def:
                cmd_def.deleteMe()
                
    except:
        if ui:
            ui.messageBox('Failed to stop UDC Bridge:\n{}'.format(traceback.format_exc()))