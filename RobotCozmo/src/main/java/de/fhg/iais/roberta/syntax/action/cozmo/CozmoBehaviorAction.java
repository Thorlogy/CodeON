package de.fhg.iais.roberta.syntax.action.cozmo;

import de.fhg.iais.roberta.syntax.action.Action;
import de.fhg.iais.roberta.transformer.forClass.NepoPhrase;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoPhrase(name = "COZMO_BEHAVIOR_ACTION", category = "ACTOR", blocklyNames = {"cozmoActions_behavior"})
public final class CozmoBehaviorAction extends Action {
    @NepoField(name = "MODE")
    public final String mode;

    public CozmoBehaviorAction(BlocklyProperties properties, String mode) {
        super(properties);
        this.mode = mode;
        setReadOnly();
    }
}
