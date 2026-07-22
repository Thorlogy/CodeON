package de.fhg.iais.roberta.syntax.action.cozmo;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "COZMO_HEAD_LIGHT_ACTION", category = "ACTOR", blocklyNames = {"cozmoActions_headLight"})
public final class CozmoHeadLightAction extends Action {
    @NepoField(name = "MODE")
    public final String mode;

    public CozmoHeadLightAction(BlocklyProperties properties, String mode) {
        super(properties);
        this.mode = mode;
        setReadOnly();
    }
}
