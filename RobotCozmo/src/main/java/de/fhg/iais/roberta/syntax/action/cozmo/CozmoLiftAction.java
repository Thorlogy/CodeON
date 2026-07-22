package de.fhg.iais.roberta.syntax.action.cozmo;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "COZMO_LIFT_ACTION", category = "ACTOR", blocklyNames = {"cozmoActions_lift"})
public final class CozmoLiftAction extends Action {
    @NepoField(name = "MODE")
    public final String mode;

    public CozmoLiftAction(BlocklyProperties properties, String mode) {
        super(properties);
        this.mode = mode;
        setReadOnly();
    }
}
