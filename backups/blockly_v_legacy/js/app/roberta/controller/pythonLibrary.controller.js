define(["require", "exports", "jquery", "python_templates", "import.controller"], function (require, exports, $, python_templates, importController) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.init = void 0;

    var currentTemplate = null;

    function init() {
        $("#menuPythonLibrary").on("click", function () {
            show();
        });

        // Bind Load Button
        $("#loadPythonTemplate").on("click", function () {
            if (currentTemplate) {
                // Load the program using the import controller's logic
                // loadProgramFromXML(name, xml)
                importController.loadProgramFromXML(currentTemplate.title, currentTemplate.xml);
                $("#pythonLibraryModal").modal("hide");
            }
        });
    }
    exports.init = init;

    function show() {
        var $list = $("#pythonTemplateList");
        $list.empty();
        $("#pythonPreview").text("");
        $("#templateDescription").text("Wähle eine Vorlage aus der Liste.");
        $("#loadPythonTemplate").prop("disabled", true);
        currentTemplate = null;

        python_templates.PYTHON_TEMPLATES.forEach(function (template) {
            var $item = $('<a href="#" class="list-group-item list-group-item-action"></a>');
            $item.text(template.title);
            $item.data("template", template);

            $item.on("click", function (e) {
                e.preventDefault();
                // Highlight selection
                $list.find(".active").removeClass("active");
                $(this).addClass("active");

                // Update Preview
                currentTemplate = $(this).data("template");
                $("#pythonPreview").text(currentTemplate.pythonCode);
                $("#templateDescription").text(currentTemplate.description);
                $("#loadPythonTemplate").prop("disabled", false);
            });

            $list.append($item);
        });

        $("#pythonLibraryModal").modal("show");
    }
});
