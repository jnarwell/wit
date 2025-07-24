# scripts/application/populate_file_storage.py
import os
import uuid

def populate():
    """Creates sample files and directories for testing the file browser."""
    print("Populating file storage with sample data...")

    # Create a dummy user and project ID
    user_id = "00000000-0000-0000-0000-000000000000" # A predictable ID for testing
    project_id = "PROJ-551C12CB"

    # Define storage paths
    user_dir = os.path.join("storage", "users", user_id)
    project_dir = os.path.join("storage", "projects", project_id)

    # Create directory structures
    os.makedirs(os.path.join(user_dir, "documents", "work"), exist_ok=True)
    os.makedirs(os.path.join(project_dir, "designs", "v1"), exist_ok=True)
    os.makedirs(os.path.join(project_dir, "manufacturing"), exist_ok=True)

    # Create sample files
    with open(os.path.join(user_dir, "readme.txt"), "w") as f:
        f.write("This is a user file.")
    with open(os.path.join(user_dir, "documents", "notes.txt"), "w") as f:
        f.write("Some notes.")
    with open(os.path.join(project_dir, "designs", "v1", "schematic.pdf"), "w") as f:
        f.write("PDF content placeholder.")
    with open(os.path.join(project_dir, "manufacturing", "assembly_guide.docx"), "w") as f:
        f.write("Docx content placeholder.")

    print("File storage populated successfully.")

if __name__ == "__main__":
    populate()
