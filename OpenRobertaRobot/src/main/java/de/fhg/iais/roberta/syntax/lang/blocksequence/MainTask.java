package de.fhg.iais.roberta.syntax.lang.blocksequence;

import java.util.Collections;
import java.util.List;

import de.fhg.iais.roberta.blockly.generated.Block;
import de.fhg.iais.roberta.blockly.generated.Data;
import de.fhg.iais.roberta.blockly.generated.Field;
import de.fhg.iais.roberta.blockly.generated.Mutation;
import de.fhg.iais.roberta.blockly.generated.Statement;
import de.fhg.iais.roberta.syntax.Phrase;
import de.fhg.iais.roberta.syntax.lang.stmt.StmtList;
import de.fhg.iais.roberta.transformer.Ast2Jaxb;
import de.fhg.iais.roberta.transformer.Jaxb2Ast;
import de.fhg.iais.roberta.transformer.Jaxb2ProgramAst;
import de.fhg.iais.roberta.transformer.forClass.NepoBasic;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;
import de.fhg.iais.roberta.util.dbc.Assert;
import de.fhg.iais.roberta.util.syntax.Assoc;
import de.fhg.iais.roberta.util.syntax.BlocklyConstants;

@NepoBasic(name = "MAIN_TASK", category = "TASK", blocklyNames = {"robControls_start_ardu", "robControls_start", "mbedcontrols_start", "cozmo_parallel_task"})
public final class MainTask extends Task {
    public final StmtList variables;
    public final String debug;
    public final Data data;
    public final String taskName;
    public final int taskPriority;
    public final String taskTrigger;

    public MainTask(BlocklyProperties properties, StmtList variables, String debug, Data data) {
        this(properties, variables, debug, data, null, 0, "START");
    }

    public MainTask(
        BlocklyProperties properties,
        StmtList variables,
        String debug,
        Data data,
        String taskName,
        int taskPriority,
        String taskTrigger) {
        super(properties);
        Assert.isTrue(variables != null && variables.isReadOnly());
        this.variables = variables;
        this.debug = debug;
        this.data = data;
        this.taskName = taskName;
        this.taskPriority = Math.max(0, Math.min(100, taskPriority));
        this.taskTrigger = taskTrigger == null ? "START" : taskTrigger;
        setReadOnly();
    }

    @Override
    public int getPrecedence() {
        return 0;
    }

    @Override
    public Assoc getAssoc() {
        return null;
    }

    @Override
    public String toString() {
        return "MainTask [" + this.variables + "]";
    }

    public static Phrase xml2ast(Block block, Jaxb2ProgramAst helper) {
        String debug = null;
        List<Field> fields = block.getField();
        if ( !fields.isEmpty() ) {
            debug = Jaxb2Ast.optField(fields, "DEBUG");
        }
        String taskName = Jaxb2Ast.optField(fields, "TASK_NAME");
        String taskTrigger = Jaxb2Ast.optField(fields, "TASK_TRIGGER");
        String priorityField = Jaxb2Ast.optField(fields, "TASK_PRIORITY");
        int taskPriority = 0;
        if ( priorityField != null ) {
            try {
                taskPriority = Integer.parseInt(priorityField);
            } catch ( NumberFormatException ignored ) {
                taskPriority = 0;
            }
        }
        if ( block.getMutation() != null && block.getMutation().isDeclare() == true ) {
            List<Statement> statements = Jaxb2Ast.extractStatements(block, (short) 1);
            StmtList statement = helper.extractStatement(statements, BlocklyConstants.ST);
            return new MainTask(Jaxb2Ast.extractBlocklyProperties(block), statement, debug, block.getData(), taskName, taskPriority, taskTrigger);
        }
        StmtList listOfVariables = new StmtList();
        listOfVariables.setReadOnly();
        return new MainTask(Jaxb2Ast.extractBlocklyProperties(block), listOfVariables, debug, block.getData(), taskName, taskPriority, taskTrigger);
    }

    @Override
    public List<Block> ast2xml() {
        boolean declare = !this.variables.get().isEmpty();

        Block jaxbDestination = new Block();
        Ast2Jaxb.setBasicProperties(this, jaxbDestination);
        Mutation mutation = new Mutation();
        mutation.setDeclare(declare);
        jaxbDestination.setMutation(mutation);
        jaxbDestination.setData(data);
        if ( this.debug != null ) {
            Ast2Jaxb.addField(jaxbDestination, "DEBUG", this.debug);
        }
        if ( this.getProperty().blockType.equals("cozmo_parallel_task") ) {
            Ast2Jaxb.addField(jaxbDestination, "TASK_NAME", this.taskName == null ? "Task" : this.taskName);
            Ast2Jaxb.addField(jaxbDestination, "TASK_PRIORITY", Integer.toString(this.taskPriority));
            Ast2Jaxb.addField(jaxbDestination, "TASK_TRIGGER", this.taskTrigger);
        }
        Ast2Jaxb.addStatement(jaxbDestination, BlocklyConstants.ST, this.variables);
        return Collections.singletonList(jaxbDestination);
    }

}
