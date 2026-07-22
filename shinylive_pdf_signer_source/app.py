from datetime import date
from pathlib import Path

from shiny import App, ui


app_ui = ui.page_fluid(
    ui.tags.meta(name="viewport", content="width=device-width, initial-scale=1, viewport-fit=cover"),
    ui.tags.meta(name="theme-color", content="#2251cc"),
    ui.tags.meta(name="apple-mobile-web-app-capable", content="yes"),
    ui.tags.meta(name="apple-mobile-web-app-status-bar-style", content="default"),
    ui.tags.link(rel="manifest", href="manifest.webmanifest"),
    ui.tags.link(rel="apple-touch-icon", href="apple-touch-icon.png"),
    ui.tags.link(rel="stylesheet", href="styles.css"),
    ui.tags.script(type="module", src="signer.js"),
    ui.div(
        ui.div(
            ui.h1("Sign & Return PDF", class_="app-title"),
            ui.p(
                "Add a handwritten signature, typed name, date, or short text—entirely in your browser.",
                class_="app-subtitle",
            ),
            class_="hero-copy",
        ),
        ui.div("PDFs are processed on this device", class_="privacy-pill"),
        class_="hero",
    ),
    ui.div(
        ui.div(
            ui.h2("1. Open the PDF", class_="section-title"),
            ui.tags.label("Choose a PDF", for_="pdfFile", class_="field-label"),
            ui.tags.input(
                id="pdfFile",
                type="file",
                accept="application/pdf,.pdf",
                class_="form-control file-control",
            ),
            ui.div("No PDF selected", id="fileStatus", class_="muted status-line", role="status"),
            class_="panel",
        ),
        ui.div(
            ui.h2("2. Your details", class_="section-title"),
            ui.div(
                ui.div(
                    ui.tags.label("Full name", for_="fullName", class_="field-label"),
                    ui.tags.input(
                        id="fullName",
                        type="text",
                        autocomplete="name",
                        placeholder="Your full name",
                        class_="form-control",
                    ),
                    class_="field-group",
                ),
                ui.div(
                    ui.tags.label("Date", for_="signDate", class_="field-label"),
                    ui.tags.input(
                        id="signDate",
                        type="date",
                        value=date.today().isoformat(),
                        class_="form-control",
                    ),
                    class_="field-group",
                ),
                class_="field-grid",
            ),
            ui.tags.label("Optional text", for_="customText", class_="field-label"),
            ui.tags.input(
                id="customText",
                type="text",
                placeholder="e.g., Approved or Initials",
                class_="form-control",
            ),
            class_="panel",
        ),
        ui.div(
            ui.h2("3. Draw your signature", class_="section-title"),
            ui.div(
                ui.tags.canvas(id="signatureCanvas", **{"aria-label": "Signature drawing area"}),
                class_="signature-wrap",
            ),
            ui.div(
                ui.tags.button("Clear", id="clearSignatureBtn", type="button", class_="btn btn-secondary"),
                ui.tags.button("Use this signature", id="saveSignatureBtn", type="button", class_="btn btn-primary"),
                class_="button-row",
            ),
            ui.div("Draw above, then tap “Use this signature.”", id="signatureStatus", class_="muted status-line", role="status"),
            class_="panel",
        ),
        class_="setup-grid",
    ),
    ui.div(
        ui.div(
            ui.h2("4. Place items on the PDF", class_="section-title no-margin"),
            ui.p("Tap an item, then tap the page. Drag placed items to reposition them.", class_="muted compact-help"),
            class_="document-heading",
        ),
        ui.div(
            ui.tags.button("‹", id="prevPageBtn", type="button", class_="icon-btn", **{"aria-label": "Previous page"}),
            ui.span("Page 0 of 0", id="pageIndicator", class_="page-indicator"),
            ui.tags.button("›", id="nextPageBtn", type="button", class_="icon-btn", **{"aria-label": "Next page"}),
            class_="page-nav",
        ),
        ui.div(
            ui.tags.button("Signature", type="button", class_="tool-btn", **{"data-tool": "signature"}),
            ui.tags.button("Name", type="button", class_="tool-btn", **{"data-tool": "name"}),
            ui.tags.button("Date", type="button", class_="tool-btn", **{"data-tool": "date"}),
            ui.tags.button("Text", type="button", class_="tool-btn", **{"data-tool": "text"}),
            class_="tool-row",
        ),
        ui.div(
            ui.span("Selected item", class_="selection-label"),
            ui.tags.button("Smaller", id="smallerBtn", type="button", class_="btn btn-secondary btn-small"),
            ui.tags.button("Larger", id="largerBtn", type="button", class_="btn btn-secondary btn-small"),
            ui.tags.button("Delete", id="deleteItemBtn", type="button", class_="btn btn-danger btn-small"),
            class_="selection-controls hidden",
            id="selectionControls",
        ),
        ui.div(
            ui.tags.canvas(id="pdfCanvas"),
            ui.div(id="overlayLayer", **{"aria-label": "PDF annotation placement layer"}),
            id="pdfStage",
            class_="pdf-stage",
        ),
        ui.div(
            ui.tags.button("Undo last", id="undoBtn", type="button", class_="btn btn-secondary"),
            ui.tags.button("Prepare signed PDF", id="prepareBtn", type="button", class_="btn btn-primary btn-wide"),
            class_="button-row action-row",
        ),
        ui.div(
            ui.tags.button("Share or Save", id="shareBtn", type="button", class_="btn btn-success btn-wide"),
            ui.tags.button("Download copy", id="downloadBtn", type="button", class_="btn btn-secondary"),
            class_="button-row hidden",
            id="exportActions",
        ),
        ui.div("", id="appStatus", class_="status-box", role="status", **{"aria-live": "polite"}),
        ui.tags.details(
            ui.tags.summary("How to return it to the same email thread"),
            ui.tags.ol(
                ui.tags.li("Tap “Share or Save” and choose “Save to Files.”"),
                ui.tags.li("Return to Mail and open the original message."),
                ui.tags.li("Tap Reply, then attach the signed PDF from Files."),
            ),
            ui.tags.p(
                "Choosing Mail in the share sheet starts a new draft. iPhone browsers cannot directly insert a file into an already-open reply thread.",
                class_="muted",
            ),
            class_="workflow-note",
        ),
        id="documentPanel",
        class_="panel document-panel hidden",
    ),
    ui.tags.footer(
        "This adds visible signature marks; it is not a certificate-based cryptographic digital signature.",
        class_="footer-note",
    ),
    class_="app-shell",
)


def server(input, output, session):
    pass


app_dir = Path(__file__).parent
app = App(app_ui, server, static_assets=app_dir / "www")
