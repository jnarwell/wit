# Gemini Guidelines for the W.I.T. Project

This document provides a set of core principles to guide Gemini's actions when assisting with the development of the W.I.T. (Workshop & Inventory Terminal) project. The goal is to ensure all contributions are safe, consistent, and aligned with the project's vision.

## 1. Informed Action: Read Before You Write

Before making any changes to the codebase, you must first thoroughly understand the context.

- **Analyze First:** Never modify a file without first reading it to understand its purpose, structure, and existing conventions.
- **Check Dependencies:** Examine related files, imports, and configurations (`package.json`, `requirements.txt`, etc.) to ensure your changes are idiomatic and won't break existing functionality.
- **Prioritize Safety:** When in doubt, ask for clarification. It is always better to ask than to introduce a breaking change.

## 2. Router Continuity: Mind the API

The project's API is under active development and is subject to rapid change. Special attention must be paid to API routing to ensure stability and prevent regressions.

- **Verify All Routes:** When working on features that touch the API, always verify that the frontend requests match the backend router definitions. Check HTTP methods (GET, POST, etc.), URL paths, and data schemas.
- **Trace the Flow:** If a routing issue is suspected, trace the entire data flow from the frontend component making the request to the backend router handling it. This includes examining any middleware or dependencies.
- **Document Changes:** When adding or modifying API endpoints, ensure the changes are clearly documented in the `CHANGELOG.md`.

## 3. Overall Vision: A Universal Maker's Management Tool

The ultimate vision for W.I.T. is to create a universal management tool for makers, hobbyists, and small workshops. This tool should be capable of managing everything from 3D printers and CNC machines to inventory, projects, and documentation.

- **Think Holistically:** When implementing new features, consider how they fit into the larger vision. Features should be modular, extensible, and designed to support a wide range of hardware and workflows.
- **Prioritize User Experience:** The user interface should be intuitive, responsive, and powerful. The goal is to create a tool that is both easy to use for beginners and flexible enough for advanced users.
- **Focus on Integration:** The W.I.T. should be able to integrate with a variety of third-party tools and services, such as CAD software, slicers, and version control systems.

## 4. AI Feature Parity: Empower the User's AI

A core principle of this project is that the user's AI assistant should be just as capable as the user themselves.

- **Mirror User Features:** Any new feature or capability given to the user through the UI must also be made available to the AI as a "tool" or "action."
- **Maintain Context:** The AI should have access to the same context as the user, including the current project, selected files, and user-specific data.
- **Enable Automation:** The AI should be able to automate complex tasks by combining multiple tools and actions. For example, the AI should be able to create a new project, add a task, and upload a file in a single command.
