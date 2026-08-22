##  Manage a goal’s projects

  Goal detail should provide an entry for creating a new Project and selecting which
  existing Project is the goal’s current plan.

  ### Create project

  - Show “New project” in the Projects section, including when the section is empty.
  - The new Project is permanently associated with the current Goal.
  - Require a non-empty name.
  - An optional due date must be earlier than the Goal’s due date.
  - Define whether creation leaves the Project in `planning` status or immediately
    makes it the current plan.
  - After success, refresh Goal detail and display the new Project.

  ### Select current plan

  - Allow eligible non-archived Projects belonging to this Goal to become the current plan.
  - The already-active Project is shown as selected and cannot be selected again.
  - Selecting another Project activates it and pauses the previously active Project.
  - Define whether `done` and `failed` Projects are eligible; recommended: exclude them.
  - If switching away from an active Project, ask for confirmation.
  - After success, refresh the Project list and “Current plan” marker.