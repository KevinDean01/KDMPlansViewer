# KDM Garden Plans Viewer - User Guide

Use the viewer to inspect a KDM model, follow its build instructions, check component sizes and fixings, and view the accompanying PDF plans.

## 1. Open your model and plans

After purchasing your plans on Etsy, download the supplied **`.kdm` model file** and **PDF build plans** from Etsy and save them to your device. If the downloads are supplied in a ZIP archive, extract the files first.

> **[Click here to Open App](https://kevindean01.github.io/KDMPlansViewer/)**

1. Select **Click here to Open App** above to open the viewer in a modern browser. No app installation is required.
2. Click **Open KDM Model** and select your `.kdm` model file.
3. Wait for the status message to confirm that the model has loaded.
4. Click **Open PDF Plans** and select the PDF build plans you downloaded from Etsy.
5. Select **Fabrication** to follow the build plan from the beginning.

Opening a PDF displays it alongside the model. Use **Hide PDF** or **Show PDF** to close or reopen the PDF panel without loading the file again.

On desktop, use the browser's PDF controls. On iPhone and iPad, use **Previous Page**, **Next Page**, or swipe left and right on the PDF page. On narrow screens, the PDF and model panels stack vertically.

## 2. Move around the 3D view

| Action | Mouse | Touchscreen |
| --- | --- | --- |
| Rotate the model | Hold the left mouse button and drag | Drag with one finger |
| Zoom | Scroll the mouse wheel | Pinch with two fingers |
| Pan | Hold the right mouse button and drag | Move two fingers together |

Use these gestures over the 3D scene, not over the fixings panel or PDF.

To select a component, click its entry in the **Components** list.

## 3. Follow the build plan

The buttons along the bottom select the three build phases:

| Phase | What it shows with Build It ON |
| --- | --- |
| **Fabrication** | All components sharing the same fabrication instruction code, such as F1 or F2 |
| **Sub Assembly** | The components and associated fixings for the selected sub-assembly step |
| **Main Assembly** | The assembly up to the selected step, including components from earlier main-assembly steps |

### Fabrication groups

Components with the same OA-FAB code are fabricated together in one step. For example, five components with code F1 appear together rather than requiring five separate navigation steps.

A visible component in the group is highlighted automatically. Click another component in the list to move the highlight and leader label to that component.

### Navigate between steps

- **Next Step** advances to the next step in the selected phase.
- **Previous Step** returns to the previous step in that phase.
- When a phase is complete, click the next phase button yourself.
- Selecting a phase starts at its first step.

Next and Previous do not automatically switch between phases.

### Read the step labels

The prominent label above the Components list shows **Build Plan Step X / Total**.

This numbering continues across all phases in order:

1. Fabrication
2. Sub Assembly
3. Main Assembly

For example, a plan containing three fabrication steps, two sub-assembly steps, and two main-assembly steps is numbered:

| Phase | Overall step numbers |
| --- | --- |
| Fabrication | 1-3 |
| Sub Assembly | 4-5 |
| Main Assembly | 6-7 |

The label at the top of the 3D view also shows the selected phase, its local step number, instruction code, and available instruction notes.

### Build It and Overview

**Build It: ON** filters the Components list to the current step and controls which parts appear in the scene. Main Assembly builds up progressively; Fabrication and Sub Assembly show their current groups.

Click **Build It** to turn it OFF when you want to inspect the wider model and component list while retaining the selected step. Fixings remain hidden in Fabrication mode.

**Overview** clears the selected step:

- With Build It ON, this returns to the phase's start state. The scene is blank until you press **Next Step**.
- With Build It OFF, you can inspect the model without a selected build step.

Overview does not reset the camera.

## 4. Inspect components and labels

Each component entry shows its name and, where available, its size.

- Click an entry to select and highlight that component.
- Hover over an entry to see available instruction notes in its tooltip.
- Click the eye button to hide or show a component.
- Click **Unhide all** to restore manually hidden components. Build-step filtering still applies.

Component sizes are reported as **width x depth x length**.

The **Labels: ON/OFF** button controls the leader line and label in the scene. It does not hide the build-step counters or fixings panel.

In Fabrication, the leader points to the selected component. With Build It ON, the Sub Assembly and Main Assembly leader labels describe the current step or group.

## 5. Check the fixings for the current step

The **Step Fixings** panel opens by default below **Previous Step**. Click **Fixings** in the top toolbar to hide or show it.

The panel groups the current step's fixings by type and size:

| Column | Meaning |
| --- | --- |
| **Type** | The fixing type, such as an oval nail or screw |
| **Size** | Fixing **diameter x length** |
| **Qty** | The number of matching fixings assigned to the current step |

For example, `2.6x50mm` means a fixing with a 2.6 mm diameter and a 50 mm length.

- The list updates as you change steps or phases.
- Quantities include fixings hidden by surrounding parts.
- Earlier main-assembly steps' fixings are not added to the current step's quantities.
- Scroll inside the panel if the list is long.
- **No fixings used in this step** means the step has no assigned fixings.
- A `?` marks an unspecified dimension. **Not specified** means neither dimension is available.

### Red fixing highlights

Fixings highlighted in red show their full shape through surrounding components, including buried shafts. This helps you locate them and see their direction.

When they are no longer highlighted, fixings return to normal visibility: surrounding timber may hide the shaft so that only the head is visible.

## 6. Switch between Metric and Imperial

Click **Units: Metric** or **Units: Imperial**, immediately after **Settings**, to switch size reporting.

- **Metric:** millimetres.
- **Imperial:** inches, displayed as fractions rounded to the nearest 1/16 inch.

The selected units update component sizes, component leader labels, and fixing sizes. They do not alter the model, selected step, component visibility, or fixing quantities.

The viewer initially detects the reporting units from the model filename or dimension data. Once you choose units, that choice remains in effect when you load another model during the same page session.

Reloading the page resets the choice. If a component has no usable dimension data, its existing name-based size label may remain unchanged.

## 7. Adjust lighting

Click **Settings** to show or hide the lighting controls:

- **Light:** adjusts scene lighting intensity.
- **Shadow Darkness:** adjusts shadow opacity.
- **Shadow Softness:** adjusts shadow softness.

Shadow effects depend on device support. Settings, Fixings, and Labels can be toggled independently.
