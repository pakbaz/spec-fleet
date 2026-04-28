# Load Skill

A standard procedure for an agent that needs lazy-loaded knowledge:

1. Identify which skill file is relevant (by name).
2. Read `.eas/skills/<name>.md` *only* when needed.
3. Apply the skill's instructions.
4. Discard from context after use to free budget.
