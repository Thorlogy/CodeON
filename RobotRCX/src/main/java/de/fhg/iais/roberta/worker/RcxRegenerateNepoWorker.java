package de.fhg.iais.roberta.worker;

import de.fhg.iais.roberta.components.Project;

/**
 * RCX has no Textly regeneration visitor. Preserve the generated NQC source
 * while the generic worker rebuilds the Blockly XML for the client response.
 */
public final class RcxRegenerateNepoWorker extends RegenerateNepoWorker {

    @Override
    public void execute(Project project) {
        String sourceCode = project.getSourceCodeBuilder().toString();
        super.execute(project);
        project.setSourceCode(sourceCode);
    }
}
