# How to Build

# **How to Use This Document**

## **Purpose**

This Product Requirements Document (PRD) serves as the single source of truth for Cognify.

Its purpose is to define how the product should function, how users should experience it, and how every major system should work together to create an effective communication training platform.

This document defines **what** Cognify should do and **why** it should behave that way. It does **not** prescribe specific technical implementations. Engineering decisions should support the product requirements rather than redefine them.

When implementation decisions arise, the behavior described in this document should take precedence over convenience or assumptions.

---

## **Guiding Principles**

When building Cognify:

* Prioritize the user experience over implementation convenience.  
* Build reusable systems rather than isolated features.  
* Keep complexity behind the scenes and simplicity in front of the user.  
* Follow the Product Standards defined in Section 11\.  
* If implementation requires assumptions that are not defined in this document, document those assumptions and confirm them before making permanent product decisions.

The objective is not simply to build features.

The objective is to build a product that measurably improves communication.

# **Recommended Development Roadmap**

The PRD is organized to explain the product conceptually. The recommended implementation order below is organized by technical dependencies.

Each phase builds upon the systems created in previous phases.

Complete one phase before beginning the next. Avoid building multiple major systems simultaneously.

The objective is to establish a stable, reusable architecture before adding additional product complexity.

---

# **Phase 1 — Product Foundation**

**Objective**

Establish the technical foundation that every other system depends on.

### **Build**

### **User System**

* Authentication  
* User accounts  
* User onboarding  
* User settings  
* User profile

### **Database**

Create the core data models for:

* Users  
* Exercises  
* Prompts  
* Workouts  
* Skill Labs  
* Build a Rep sessions  
* Communication Scores  
* Progress history  
* Rank  
* Streaks  
* Achievements

### **Application Framework**

Build:

* Navigation  
* Screen routing  
* Design system  
* Component library  
* Theme  
* Responsive layouts

### **AI Infrastructure**

Create:

* AI request architecture  
* Prompt management  
* Evaluation pipeline  
* Memory architecture  
* Logging  
* Error handling

### **Deliverable**

A stable application capable of supporting every major Cognify system.

Do not begin building communication training until this foundation is complete.

---

# **Phase 2 — Universal Training Engine**

**Objective**

Build the learning engine that powers the entire product.

This is the most important phase of development.

Daily Workout, Skill Lab, and Build a Rep should all reuse this engine.

Do **not** build three separate training systems.

### **Build**

Create the universal training flow:

Coach’s Insight

↓

Exercise

↓

First Rep

↓

AI Evaluation

↓

Feedback

↓

Retry

↓

Improvement Review

↓

Score Updates

↓

Session Complete

### **Create reusable components**

* Exercise renderer  
* Recording system  
* AI evaluation pipeline  
* Coaching generation  
* Retry generation  
* Score calculation  
* Session management

### **Deliverable**

One complete end-to-end learning loop that works independently of any specific training mode.

Once this engine works, every future training experience should simply configure it rather than recreate it.

---

# **Phase 3 — Daily Workout**

**Objective**

Build Cognify’s primary daily experience.

Daily Workout should become the first complete user-facing feature.

### **Build**

Workout generation

↓

Exercise selection

↓

Prompt selection

↓

Coach’s Insight

↓

Universal Training Engine

↓

Workout Complete

### **Implement**

* Workout generation logic  
* Exercise rotation  
* Prompt rotation  
* Workout completion  
* Workout history

### **Deliverable**

Users can complete an entire Daily Workout from start to finish.

No placeholder functionality should remain.

---

# **Phase 4 — Skill Lab**

**Objective**

Expand the Universal Training Engine into communication applications.

### **Build**

Application selection

↓

Application introduction

↓

Application Exercise Frameworks

↓

Universal Training Engine

↓

Application Review

### **Implement**

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

Only create:

* Application-specific Exercise Frameworks  
* Application scoring  
* Application UI

Everything else should reuse existing systems.

### **Deliverable**

All MVP Skill Lab applications function using the same learning engine.

---

# **Phase 5 — Build a Rep**

**Objective**

Allow users to prepare for real-world communication.

### **Build**

Scenario creation

↓

Context upload

↓

Preparation setup

↓

Universal Training Engine

↓

Readiness Review

### **Implement**

* Context input  
* AI scenario generation  
* Critical Moments  
* Preparation modes  
* Context-aware coaching  
* Readiness Review

Reuse:

* Coaching  
* Retry  
* Evaluation  
* Scoring

### **Deliverable**

Users can prepare for real conversations using the same learning architecture.

---

# **Phase 6 — Progression & Motivation**

**Objective**

Reward improvement after the core training experience is complete.

### **Build**

Communication Score

↓

Fundamental Scores

↓

Application Scores

↓

Rank

↓

Streaks

↓

Achievements

↓

Leaderboards

↓

Workout Completion Experience

### **Deliverable**

Users can clearly see their progress and feel motivated to continue training.

---

# **Phase 7 — Intelligence Layer**

**Objective**

Personalize Cognify using data collected from user training.

Do not build personalization before enough user data exists to support it.

### **Build**

Communication Profile

↓

Hidden Subskill Scores

↓

Adaptive Exercise Selection

↓

Adaptive Coaching

↓

Communication Insights

↓

Long-term Memory

### **Deliverable**

Every user begins receiving increasingly personalized training while the experience remains simple and intuitive.

---

# **Phase 8 — Content Expansion**

**Objective**

Scale content using the architecture already established.

### **Expand**

* Exercise library  
* Prompt library  
* Skill Lab content  
* Build a Rep scenarios

No architectural changes should be required.

The system should be capable of supporting unlimited content.

---

# **Phase 9 — Polish & Optimization**

Only after the product is fully functional.

Focus on:

* Performance  
* Animations  
* Haptics  
* Accessibility  
* Error handling  
* UI refinement  
* Empty states  
* Loading states  
* Visual polish

## **Working with Claude Code**

Claude Code should use this document as the primary reference when implementing Cognify.

For each major section:

1. Read the section in its entirety before writing code.  
2. Create an implementation plan that aligns with the product requirements.  
3. Implement one complete system before beginning the next.  
4. Reuse existing architecture whenever possible.  
5. If requirements are ambiguous or conflicting, stop and resolve the ambiguity before continuing.

Claude Code should optimize for maintainability, scalability, and consistency with the product requirements—not simply the fastest implementation.

---

## **Definition of Done**

A feature should only be considered complete when it:

* Behaves as defined in this document.  
* Integrates cleanly with existing systems.  
* Supports Cognify’s learning philosophy.  
* Meets the Product Standards defined in Section 11\.  
* Is ready to be tested by real users.

The goal is not to finish features quickly.

The goal is to build a communication training platform that users trust, enjoy using, and consistently return to because it makes them better communicators.

\*\*\*\*\***Terminology Clarification**

Throughout this document, the terms **Subskills**, **Hidden Behaviors**, and **Underlying Behaviors** may appear interchangeably.

For implementation purposes, these should all be treated as the same concept and collectively referred to as **Hidden Skills**.

Hidden Skills represent the granular communication abilities that power Cognify’s intelligence layer. They are evaluated behind the scenes by AI, influence coaching, scoring, personalization, and long-term development, and are not directly exposed to users.

Users interact with:

* Overall Communication Score  
* Fundamental Scores  
* Application Scores

The AI additionally tracks Hidden Skills to understand *why* a user performed the way they did and to deliver increasingly personalized coaching over time.

Unless otherwise specified, all references to Subskills, Hidden Behaviors, or Underlying Behaviors should be interpreted as Hidden Skills.

# Table of Contents

# **Table of Contents**

## **1\. What Cognify Is**

* **Vision**  
* **The Problem**  
* **Why Communication Matters**  
* **Why Existing Solutions Fail**  
* **Where Cognify Started**  
* **Where Cognify Is Going**  
* **Who Cognify Is For**  
* **What Cognify Does**  
* **Why Cognify Is Different**  
  ---

  ## **2\. Training Philosophy**

  ### **2.1 Purpose**

  ### **2.2 Communication Is a Trainable Skill**

  ### **2.3 Communication Improvement Requires More Than Repetition**

  ### **2.4 Deliberate Practice**

  ### **2.5 Neuroplasticity & Habit Formation**

  ### **2.6 Cognify’s Theory of Improvement**

  ### **2.7 Definition of Success**

  ---

  ## **3\. Product Architecture**

  ### **3.1 Purpose**

  ### **3.2 The Three Training Modes**

* Daily Workout  
* Skill Lab  
* Build a Rep

  ### **3.3 Why Three Separate Modes Exist**

  ### **3.4 How the Modes Work Together**

  ### **3.5 Product Design Principles**

  ### **3.6 Success Criteria**

  ---

  ## **4\. The Cognify Training System**

  ### **4.1 Purpose**

  ### **4.2 The Cognify Learning Loop**

  ### **4.3 Stage 1: Preparation**

* Coach’s Insight

  ### **4.4 Stage 2: Performance**

* First Rep

  ### **4.5 Stage 3: Feedback**

* Communication Score  
* Coach’s Focus  
* Core Skill Breakdown

  ### **4.6 Stage 4: Implementation**

* Retry

  ### **4.7 Stage 5: Improvement Review**

* Improvement Review  
* Score Movement

  ### **4.8 AI Coach Philosophy**

  ### **4.9 Learning Loop Variations**

  ### **4.10 Success Criteria**

  ---

  ## **5\. Daily Workout**

  ### **5.1 Purpose**

  ### **5.2 Daily Workout Structure**

  ### **5.3 Workout Rotation System**

  ### **5.4 Adaptive Rotation**

  ### **5.5 Core Skill Framework**

  ### **5.6 Prompt Selection**

  ### **5.7 Workout Complete**

  ### **5.8 Success Criteria**

  ---

  ## **6\. Skill Lab**

  ### **6.1 Purpose**

  ### **6.2 Communication Applications**

  ### **6.3 Application Selection**

  ### **6.4 Session Structure**

  ### **6.5 Application Framework**

  ### **6.6 Adaptive Practice**

  ### **6.7 Application-Specific Coaching**

  ### **6.8 Mastery Development**

  ### **6.9 Session Complete**

  ### **6.10 Success Criteria**

  ---

  ## **7\. Build a Rep**

  ### **7.1 Purpose**

  ### **7.2 Readiness vs. Mastery**

  ### **7.3 Creating a Build a Rep**

  ### **7.4 Context Uploads**

  ### **7.5 Context-Aware Personalization**

  ### **7.6 Critical Moments**

  ### **7.7 User-Controlled Critical Moments**

  ### **7.8 Context-Driven Critical Moments**

  ### **7.9 Preparation Modes**

  ### **7.10 Simulation Types**

  ### **7.11 Timing Recommendations**

  ### **7.12 Context-Aware Coaching**

  ### **7.13 Readiness Review**

  ### **7.14 Simulation Architecture**

  ### **7.15 Success Criteria**

  ---

  ## **8\. Personalization System**

  ### **8.1 Purpose**

  ### **8.2 User Profile**

  ### **8.3 Communication Profile**

  ### **8.4 Adaptive Training**

  ### **8.5 Adaptive Exercise Selection**

  ### **8.6 Adaptive Coaching**

  ### **8.7 Communication Intelligence**

  ### **8.8 Design Principles**

  ---

  ## **9\. Exercise & Prompt Architecture**

  ### **9.1 Purpose**

  ### **9.2 Content Architecture**

  ### **9.3 Exercise Banks**

  ### **9.4 Prompt Banks**

  ### **9.5 Prompt Design Standards**

  ### **9.6 Prompt Refresh Logic**

  ### **9.7 Exercise Selection Logic**

  ### **9.8 Exercise Diversity Rules**

  ### **9.9 Content Flywheel**

  ### **9.10 Content Expansion Strategy**

  ---

  ## **10\. Progression & Motivation System**

  ### **10.1 Purpose**

  ### **10.2 Communication Score**

  ### **10.3 Fundamental Scores**

  ### **10.4 Application Scores**

  ### **10.5 Hidden Subskill Scores**

  ### **10.6 Cognify Rank**

  ### **10.7 Rank Progression**

  ### **10.8 Streaks**

  ### **10.9 Achievements**

  ### **10.10 Leaderboards**

  ### **10.11 Workout Completion Experience**

  ---

  ## **11\. Product Standards**

  ### **11.1 Purpose**

  ### **11.2 Exercise Standards**

  ### **11.3 Prompt Standards**

  ### **11.4 Coaching Standards**

  ### **11.5 Scoring Standards**

  ### **11.6 Simulation Standards**

  ### **11.7 Personalization Standards**

  ### **11.8 Product Principles**

  ---

  # **Appendix**

  ### **Appendix A — MVP Scope**

  ### **Appendix B — Future Ideas**

# Section 1: What Cognify Is

# **1\. What Cognify Is**

## **Vision**

Cognify exists to become the communication gym for ambitious professionals.

Communication is one of the most important skills in modern work. It influences interviews, presentations, sales conversations, leadership, networking, meetings, and career advancement. Despite its importance, very few people train communication intentionally.

Most people improve communication through experience alone. Some eventually become strong communicators through years of repetition. Many never do. Cognify exists to make communication improvement systematic rather than accidental.

The goal is to create a platform where users can train communication the same way they train fitness: through structured practice, coaching, measurable progress, and repetition over time.

---

## **The Problem**

Communication is one of the most valuable professional skills in the world, yet it remains one of the least intentionally developed.

People spend years communicating in meetings, interviews, presentations, and everyday conversations. Despite this constant exposure, many continue to struggle with explaining ideas clearly, organizing thoughts effectively, speaking concisely, telling compelling stories, persuading others, and communicating under pressure.

The problem is not a lack of communication opportunities. The problem is a lack of communication training. Most people communicate every day, but very few deliberately practice communication.

---

## **Why Communication Matters**

Communication acts as a force multiplier. A great idea has little value if it cannot be explained clearly. Strong technical skills have limited impact if they cannot be communicated effectively. Leadership, sales, law, medicine, politics, consulting, relationship-building, and more all depend heavily on communication.

In many situations, communication is not the skill being evaluated directly. It is the skill through which every other skill is evaluated. For ambitious professionals, communication is one of the highest-leverage skills they can develop.

---

## **Why Existing Solutions Fail**

Most communication products fall into one of three categories:

### **Content Platforms**

These products focus on lessons, frameworks, books, videos, and educational content. They help users learn about communication, but learning about communication is not the same as improving communication.

### **Feedback Platforms**

These products evaluate communication and provide feedback. Users receive insights into their strengths and weaknesses, but lack structured opportunities to immediately apply what they learned.

### **Event Preparation Tools**

These products help users prepare for a specific interview, presentation, or speech. While useful for short-term performance, they often do little to improve long-term communication ability. Despite their differences, most communication products focus on information, evaluation, or preparation. Very few focus on communication training.

---

## **Where Cognify Started**

The original vision for Cognify centered around AI communication coaching.

Users would complete exercises, receive feedback, and track performance over time. While this approach provided value, it became clear that feedback alone was not enough. Users could understand what they needed to improve without actually improving.

This realization led to a fundamental shift in how the product was designed.

---

## **Where Cognify Is Going**

The current vision for Cognify is built around a simple belief:

**Communication improvement occurs through implementation.**

Rather than focusing primarily on feedback, Cognify focuses on feedback followed by practice. Rather than functioning like a communication course, Cognify functions like a communication gym.

The goal is not simply to help users understand communication better. The goal is to help users communicate better.

---

## **Who Cognify Is For**

Cognify is designed for ambitious professionals who view communication as a competitive advantage. The ideal user wants to become a stronger storyteller, interviewer, presenter, persuader, leader, or communicator overall. Many already consume communication content. What they lack is a structured environment where they can practice, receive coaching, implement feedback, and measure improvement over time.

---

## **What Cognify Does**

Cognify provides a structured system for communication development. The platform is built around three training modes that help users develop communication fundamentals, apply those skills in common communication environments, and prepare for real-world communication events. Together, these experiences create a progression from skill development to real-world performance.

---

## **Why Cognify Is Different**

Most communication products help users learn about communication. Cognify is designed to help users improve communication. Instead of prioritizing lessons, Cognify prioritizes practice. Instead of stopping at feedback, Cognify prioritizes implementation. Instead of treating communication as a subject to study, Cognify treats communication as a skill to train. The result is a platform built around deliberate practice, coaching, implementation, and measurable improvement.

# Cognify Foundation

[https://docs.google.com/document/d/14OoHn1f1rqndCXAmfZWZLhhfO5iIRFiAjWu3zLT3B6E/edit?tab=t.nipk7ovo1fze](https://docs.google.com/document/d/14OoHn1f1rqndCXAmfZWZLhhfO5iIRFiAjWu3zLT3B6E/edit?tab=t.nipk7ovo1fze)

Add all of Owens research into the system using Claude

# Section 2: Training Philosophy

# **2\. Training Philosophy**

## **Purpose**

The purpose of this section is to define the learning philosophy that powers every part of Cognify.

Every exercise, coaching interaction, retry, score, recommendation, personalization decision, and future feature should align with these principles. These ideas are not marketing statements. They are the foundation of how Cognify believes communication improvement occurs.

If a future feature does not support this philosophy, it should be reconsidered.

---

## **Communication Is A Trainable Skill**

Cognify is built on the belief that communication is a skill, not a personality trait.

Many people assume they are naturally good communicators or naturally bad communicators. They see confidence, storytelling ability, persuasion, public speaking, and executive presence as qualities that some people are born with and others are not.

Cognify rejects that assumption.

Communication is ultimately a collection of behaviors. The ability to explain an idea clearly, tell a compelling story, think under pressure, lead a meeting, answer an interview question, or persuade another person is not a fixed trait. These are learned behaviors that can be practiced, measured, coached, and improved over time.

Like fitness, communication development is the result of consistent training. The goal of Cognify is not to identify talented communicators. The goal is to help users become stronger communicators through deliberate practice.

### **Product Implications**

* Communication should be trained rather than taught.  
* Users should spend more time speaking than reading.  
* Communication performance should be measurable.  
* Improvement should come from practice and implementation rather than content consumption.  
* Communication ability should improve gradually through repeated training over time.

---

## **Communication Improvement Requires More Than Repetition**

Most people communicate every day, but communication frequency does not automatically lead to communication improvement.

A person can spend years rambling, explaining ideas poorly, telling weak stories, speaking without structure, or avoiding difficult conversations without becoming significantly better at any of those things.

Repetition alone often reinforces existing habits.

Communication improves when repetition is combined with feedback, correction, and implementation. Simply speaking more is not enough. Users need a system that helps them identify what to improve, apply coaching, and practice stronger behaviors repeatedly.

This distinction is one of the most important ideas in Cognify.

The product is not designed to maximize communication volume. It is designed to maximize communication improvement.

### **Product Implications**

* Communication reps should always have a purpose.  
* Users should receive coaching after practice.  
* Feedback should identify specific improvement opportunities.  
* Practice should lead directly into implementation.  
* Improvement should be prioritized over activity.

---

## **Deliberate Practice**

The learning philosophy behind Cognify is deliberate practice. Normal practice is repetition. Deliberate practice is repetition combined with focused improvement.

A basketball player does not improve simply by playing more games. They improve by identifying weaknesses, receiving coaching, correcting mistakes, and repeatedly practicing specific skills. Communication works the same way.

The most effective communication training experiences contain four components:

* A clearly defined skill  
* Immediate feedback  
* Opportunities for correction  
* Repeated implementation

Every training experience inside Cognify should contain these elements whenever possible. Users should never feel like they are simply completing exercises. Every rep should have a purpose, every coaching interaction should identify a specific improvement opportunity, and every retry should help users apply that coaching immediately.

### **Product Implications**

* Every mode contains coaching.  
* Every mode contains performance feedback.  
* Daily Workout and The Lab require implementation through retries.  
* Coaching should focus on improving future performance rather than evaluating past performance.  
* The product should consistently create opportunities for users to apply feedback.

---

## **Neuroplasticity & Habit Formation**

Communication habits are learned behaviors. Like all learned behaviors, they can be changed.

When users repeatedly practice stronger communication behaviors, they gradually strengthen those behaviors and weaken ineffective ones. Over time, communication becomes more automatic.

This process is similar to physical training. A person does not become stronger from a single workout. They become stronger through consistent effort repeated over weeks, months, and years. Communication development follows the same pattern. Most users will not experience dramatic improvement after a single session. However, small improvements compound. A user who consistently practices, receives coaching, and implements feedback should become noticeably more effective over time.

The purpose of Cognify is to create an environment where that compounding can occur.

### **Product Implications**

* Long-term consistency should be rewarded.  
* Improvement trends are more important than individual scores.  
* Users should be encouraged to return regularly.  
* Progress systems should reinforce sustained development.  
* The product should make gradual improvement visible.

---

## **Cognify’s Theory Of Improvement**

At its core, Cognify believes communication improvement follows a simple process:

Practice

↓

Receive Coaching

↓

Implement Feedback

↓

Improve

↓

Repeat

Every major system inside the product should reinforce this cycle. The scoring system exists to make improvement visible. The coaching system exists to identify improvement opportunities. The retry system exists to encourage implementation. The personalization system exists to direct users toward their highest-leverage growth opportunities.

Each component supports the same underlying goal: helping users become stronger communicators through repeated cycles of practice and improvement.

---

## **Definition Of Success**

The ultimate goal of Cognify is behavior change. Success is not determined by the amount of content consumed, the number of lessons completed, or the amount of time spent inside the product.

Success is determined by improved communication performance. The clearest signal that Cognify is working is when users communicate more effectively outside of the product than they would have before using it. Every product decision should ultimately support that outcome.

# Section 3: Product Architecture

# **3\. Product Architecture**

## **Purpose**

The purpose of this section is to define the overall structure of Cognify and explain how the product is organized.

Communication development is not a single problem. Becoming a stronger communicator requires developing communication fundamentals, learning how to apply those fundamentals in common communication situations, and preparing for specific real-world communication events.

Most communication products attempt to solve all three problems simultaneously. The result is often a product that feels unfocused, overwhelming, and difficult to personalize.

Cognify takes a different approach. The product is intentionally divided into three distinct training modes, each designed to solve a specific communication problem. Together, these modes create a complete communication development system that guides users from foundational skill development to real-world execution.

---

## **The Three Training Modes**

Cognify is built around three primary training environments: Daily Workout, The Lab, and Build a Rep.

Each mode serves a different purpose, trains different skills, and measures success differently. While they work together as part of a larger system, they should be viewed as distinct experiences rather than variations of the same feature.

### **Daily Workout**

Daily Workout develops communication fundamentals.

This is the foundation of the entire product and the starting point for long-term communication development. The purpose of Daily Workout is to strengthen the six Core Skills that influence performance across every communication environment:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

These skills are transferable. Whether a user is interviewing, presenting, selling, networking, leading a meeting, or telling a story, their performance will ultimately be influenced by these fundamentals.

Daily Workout is most comparable to strength training in a gym. The objective is not to prepare for a specific event. The objective is to build underlying communication capability that can be applied everywhere.

Success in Daily Workout is measured by long-term improvement in the Core Skills and consistent communication practice over time.

### **The Lab**

The Lab develops communication applications. While Daily Workout focuses on communication fundamentals, The Lab focuses on applying those fundamentals inside common communication environments.

Initial applications include:

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

A user may improve Clarity, Structure, and Conciseness through Daily Workout, but they still need to learn how those skills translate into a compelling story, an effective interview answer, or a persuasive argument. The Lab exists to bridge the gap between foundational communication skills and practical communication performance.

This experience is most comparable to sport-specific training. A person may be physically strong, but they still need to learn how to apply that strength within a sport. Similarly, users need opportunities to apply communication fundamentals inside realistic communication contexts.

Success in The Lab is measured by mastery within communication applications and improvement across the underlying application subskills.

### **Build a Rep**

Build a Rep develops communication readiness. While Daily Workout focuses on long-term skill development and The Lab focuses on communication application, Build a Rep is designed to help users prepare for a specific upcoming communication event.

Examples include:

* Job Interviews  
* Discovery Calls  
* Sales Presentations  
* Investor Pitches  
* Networking Events  
* Difficult Conversations  
* Team Meetings  
* Performance Reviews  
* Wedding Toasts

Users enter Build a Rep because they have something important approaching and want to perform at their highest level. Rather than training communication broadly, Build a Rep helps users identify critical moments, practice realistic scenarios, receive coaching, and build confidence before the actual event occurs.

This experience is most comparable to preparing for a game, competition, or performance. Success in Build a Rep is measured by readiness, confidence, and real-world performance during the actual event.

---

## **Why Three Separate Modes Exist**

The three modes exist because communication development occurs in layers. A user struggling with Clarity has a different problem than a user struggling with storytelling. A user preparing for a job interview has a different goal than a user trying to improve communication generally.

Attempting to solve all of these problems inside a single experience would create unnecessary complexity and make personalization significantly more difficult.

Separating the experiences allows each mode to be optimized for its specific purpose:

* Daily Workout optimizes for consistency and foundational development.  
* The Lab optimizes for application and mastery.  
* Build a Rep optimizes for preparation and readiness.

Each mode solves a different problem, but together they create a complete communication development ecosystem.

---

## **How The Modes Work Together**

Although the three modes are distinct, they are designed to build upon one another.

The intended progression is:

Daily Workout

↓

The Lab

↓

Build a Rep

This progression mirrors how communication skills develop in the real world.

### **Step 1: Build Fundamentals**

Users first develop communication fundamentals through Daily Workout. The focus is on improving the six Core Skills that influence every communication situation. Without strong fundamentals, communication applications and real-world performance become significantly more difficult. This is where users build the foundation that supports everything else inside the product.

### **Step 2: Apply Fundamentals**

Users then apply those fundamentals inside The Lab. The objective is to learn how communication principles translate into realistic communication situations. 

This is where users learn how to:

* Tell stronger stories  
* Deliver better presentations  
* Teach more effectively  
* Interview more confidently  
* Persuade more successfully

The Lab transforms communication skills into communication capability.

### **Step 3: Prepare For Real Situations**

Users then use Build a Rep to prepare for specific communication events. Rather than practicing communication broadly, users practice the exact situations they are likely to encounter in real life. The experience becomes highly contextual and tailored to the event they are preparing for.

The result is a progression from:

Fundamentals

↓

Applications

↓

Readiness

This progression serves as the foundation of the Cognify product architecture.

---

## **Product Design Principles**

The following principles should guide every product decision inside Cognify. They exist to ensure the product remains aligned with its purpose as a communication training platform.

### **Speaking \> Reading**

Communication is a performance skill. Performance skills improve through execution rather than information consumption. Users should spend the majority of their time actively speaking, practicing, and implementing feedback rather than reading lessons, instructions, or educational content. When forced to choose between a speaking activity and a reading activity, the product should generally favor speaking.

### **Training \> Content Consumption**

Cognify is not a course platform. The objective is not to help users consume communication content. The objective is to help users improve communication performance. Every experience should prioritize active practice over passive learning.

### **Implementation \> Awareness**

Awareness alone rarely creates lasting behavior change. Users improve when they apply coaching rather than simply reading it. Feedback should lead directly into implementation opportunities whenever possible. This principle is one of the primary reasons retries exist throughout the product.

### **Simplicity \> Complexity**

Communication improvement is already difficult. The product should not become difficult to use. Users should not need to understand communication theory, scoring methodologies, subskills, personalization systems, or training frameworks in order to improve. Complexity should be handled by Cognify. Simplicity should be experienced by the user.

### **Cognify Decides, User Practices**

Most users know what outcome they want. They know they want to become better storytellers, stronger interviewers, more persuasive communicators, or more confident presenters.

What they often do not know is:

* Which subskill needs work  
* Which exercise is most appropriate  
* Which coaching point matters most  
* What they should train next

Cognify should handle diagnosis, personalization, and training selection whenever possible so users can focus on practicing.

### **Improvement Must Be Visible**

Communication improvement often occurs gradually. Without visible progress, users may struggle to recognize development and remain motivated.

The product should consistently help users see:

* Score movement  
* Improvement trends  
* Strengths  
* Weaknesses  
* Growth over time

Users should feel that they are becoming stronger communicators.

### **Every Experience Must Transfer To Real Life**

The ultimate purpose of Cognify is real-world communication improvement. Exercises should not exist simply because they are engaging. Prompts should not exist simply because they are interesting. Every experience should help users perform more effectively outside of the product. The question that should guide every feature, exercise, prompt, coaching interaction, and training experience is:

“Will this help users communicate more effectively in the real world?”

If the answer is no, the experience should be reconsidered.

---

## **Success Criteria**

The Product Architecture is successful if the three modes work together to create a complete communication development system.

Users should be able to:

* Develop communication fundamentals.  
* Apply those fundamentals in common communication situations.  
* Prepare for specific real-world communication events.

The architecture should feel intuitive, cohesive, and easy to understand. Each mode should serve a distinct purpose while contributing to the same ultimate outcome: Helping users become measurably better communicators.

## **Transition to the Cognify Training System**

The three training modes define **what** users are training.

The Cognify Training System defines **how** every training experience works.

Regardless of whether a user is completing a Daily Workout, practicing inside The Lab, or preparing for a real-world event in Build a Rep, every exercise follows the same underlying learning process.

This shared training system creates a consistent learning experience throughout the platform while allowing each mode to serve a different purpose.

The following section defines that universal learning system.

# Section 4: The Cognify Training System

# **4\. The Cognify Training System**

## **4.1 Purpose**

The Cognify Training System defines the learning framework that powers every experience inside the product.

While Daily Workout, The Lab, and Build a Rep serve different purposes, they all use the same underlying system for practice, coaching, implementation, and improvement.

This section defines the components of that system and how they work together.

---

## **4.2 The Cognify Learning Loop**

Every Cognify experience is built around the same core learning loop:

Coach’s Insight

↓

First Rep

↓

Coach Feedback

↓

Retry

↓

Improvement Review

The objective of the learning loop is simple: help users improve between attempts.

---

# **4.3 Stage 1: Preparation**

## **4.3.1 Coach’s Insight**

### **Purpose**

Every exercise begins with a Coach’s Insight.

The purpose of the insight is to direct the user’s attention toward a specific communication behavior before they begin speaking.

Insights should act as coaching cues rather than lessons.

### **What Makes A Great Insight**

The best insights are:

* Specific  
* Actionable  
* Memorable  
* Focused on a single behavior  
* Immediately applicable

### **Examples**

**Clarity**

Most people answer questions in the order they thought about them. Strong communicators answer questions in the order the audience needs to hear them.

**Structure**

Most people organize information chronologically. Strong communicators organize information by importance.

**Conciseness**

The strongest point usually gets buried underneath three weaker points. Make the strongest point and stop talking.

**Thinking Quality**

Most people stop at observations. Strong communicators explain implications.

**Storytelling**

The moment before the story gets interesting is usually the part you should delete.

### **Design Decisions**

* Every exercise begins with a Coach’s Insight.  
* Insights focus on a single behavior.  
* Insights should be consumable in a few seconds.  
* Insights should improve execution rather than teach theory.

---

# **4.4 Stage 2: Performance**

## **4.4.1 First Rep**

### **Purpose**

The First Rep is the user’s initial attempt at the exercise.

Its purpose is to establish a baseline and generate the information required for scoring, coaching, and feedback.

The First Rep should reflect how the user would naturally communicate without intervention.

---

# **4.5 Stage 3: Feedback**

## Coach Feedback consists of three components:

* ## Communication Score, which measures overall performance.

* ## Coach’s Focus, which identifies the single highest-impact improvement opportunity.

* ## Core Skill Breakdown, which provides a deeper view of performance across the six Core Skills.

## **Feedback Structure**

Communication Score

↓

Coach’s Focus

↓

Core Skill Breakdown

The purpose of the Feedback stage is to help users understand how they performed and identify the single change most likely to improve the next attempt.

---

## **4.5.1 Communication Score**

### **Purpose**

The Communication Score serves as the primary performance metric throughout the platform.

The score represents overall communication effectiveness and provides users with a simple way to understand performance and track progress over time.

Communication Scores exist at multiple levels throughout Cognify.

* **Exercise Score** measures performance on a single exercise.  
* **Workout or Session Score** summarizes performance across an entire Daily Workout, Lab session, or Build a Rep session.  
* **Overall Communication Score** represents the user’s long-term communication ability and updates over time as training data accumulates.

### **Design Decisions**

* Communication Score is the primary performance metric.  
* The same scoring framework should be used across all modes.  
* Scores should be easy to understand.  
* Long-term trends matter more than individual scores.

---

## **4.5.2 Coach’s Focus**

### **Purpose**

Coach’s Focus is the most important piece of feedback users receive.

Rather than overwhelming users with multiple corrections, Cognify identifies the single highest-leverage behavior the user should improve on the next attempt.

This becomes the objective of the Retry.

### **Design Decisions**

* Every rep receives a single Coach’s Focus.  
* Coach’s Focus should represent the highest-impact improvement opportunity.  
* The Retry should center around implementing this coaching point.  
* Users should never receive multiple primary coaching objectives simultaneously.

---

## **4.5.3 Core Skill Breakdown**

### **Purpose**

The Core Skill Breakdown gives users visibility into performance across the six Core Skills:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

Each skill displays a score and can be expanded for additional feedback.

Expanded feedback explains why the score was earned and provides skill-specific coaching.

### **Design Decisions**

* Core Skill Breakdown is collapsed by default.  
* Users can expand any skill to view detailed feedback.  
* Each skill displays its score in the collapsed state.  
* Strong scores highlight effective behaviors.  
* Lower scores identify improvement opportunities.  
* Core Skill Breakdown supports Coach’s Focus rather than replacing it.  
* Separate “What You Did Well” and “Areas For Improvement” sections do not exist.

---

# **4.6 Stage 4: Implementation**

## **Retry Structure**

Coach’s Focus

↓

What Change Could Create The Biggest Improvement?

↓

Stronger Version

↓

Retry

The purpose of the Retry Stage is to help users immediately apply the coaching they just received.

---

## **4.6.1 Retry**

### **Purpose**

The Retry is where implementation occurs.

After receiving feedback, users immediately attempt the exercise again with the goal of applying the coaching they just received.

The Retry should feel like a second attempt at the same challenge rather than a completely new exercise.

### **Design Decisions**

* Retries occur immediately after feedback.  
* Coach’s Focus carries over from the feedback screen.  
* Users should always know what they are trying to improve.  
* A Stronger Version demonstrates what stronger execution looks like.  
* The Retry should focus on implementation rather than evaluation.  
* The Retry should target a single coaching objective.

---

# **4.7 Stage 5: Improvement Review**

## **Review Structure**

Communication Score (+/- Change)

↓

Implementation Review

↓

Coach’s Focus (Next Development Opportunity)

↓

Core Skill Breakdown

The purpose of the Improvement Review is to show users whether implementation resulted in improvement and identify what they should continue developing.

---

## **4.7.1 Improvement Review**

### **Purpose**

The Improvement Review evaluates how effectively the user applied the coaching during the Retry.

The review should clearly show whether implementation resulted in improved performance and identify the next development opportunity.

### **Design Decisions**

* Users receive an updated Communication Score.  
* Score movement should be highly visible.  
* Coach’s Focus becomes the next development opportunity.  
* The same Core Skill Breakdown appears in both feedback screens.  
* Users can continue practicing or move forward.

### **Next Actions**

After completing the Improvement Review, users can:

* Retry Again  
* Next Exercise  
* 

---

## **4.7.2 Score Movement**

### **Purpose**

Communication improvement is often difficult for users to perceive in real time.

Score Movement makes progress visible by showing users how performance changes between attempts and over time.

### **Examples**

Communication Score

82 → 86 (+4)

Clarity

71 → 86 (+15)

Structure

75 → 82 (+7)

### **Design Decisions**

* Improvement should be highly visible.  
* Positive score movement should be celebrated.  
* Users should see both short-term and long-term progress.  
* Progress visualization should reinforce consistency and effort.  
* 

---

## **4.8 AI Coach Philosophy**

The AI Coach should behave like an elite communication trainer rather than an evaluator.

Its primary responsibility is identifying the highest-leverage opportunity for improvement and helping users successfully implement that change.

### **Coaching Principles**

The AI Coach should prioritize:

* Specificity over generality  
* Actionability over explanation  
* Behavior change over education  
* Improvement over evaluation

Every coaching interaction should answer a simple question:

What is the single most valuable thing this user should do differently on their next attempt?

---

## **4.9 Learning Loop Variations**

While the framework remains consistent across the platform, each mode applies the learning loop slightly differently based on its purpose.

### **Daily Workout**

Retries are required.

Users must complete the Retry before advancing to the next exercise.

### **The Lab**

Users complete a required Retry and may continue practicing additional repetitions if they choose.

The objective is mastery through repetition.

### **Build a Rep — Guided Practice**

Users receive coaching after each Critical Moment and may retry those moments as many times as needed before moving forward.

### **Build a Rep — Full Simulation**

Users complete the entire simulation without interruption and receive feedback after the simulation concludes.

Coaching is intentionally delayed until the end of the simulation to preserve realism.

---

## **4.10 Success Criteria**

The Cognify Training System is successful if users consistently improve between attempts.

A successful learning loop should help users:

* Identify improvement opportunities.  
* Implement coaching immediately.  
* Observe measurable progress.  
* Develop stronger communication habits over time.

Every experience inside Cognify should strengthen this cycle.

# Section 5: Daily Workout

# **5\. Daily Workout**

## **5.1 Purpose**

Daily Workout is Cognify’s communication fundamentals training environment.

Its purpose is to develop the six Core Skills that influence performance across every communication situation:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

Unlike The Lab, which focuses on communication applications, or Build a Rep, which focuses on preparing for specific communication events, Daily Workout focuses on foundational skill development.

Daily Workout should serve as the primary daily habit inside Cognify and the foundation upon which all other communication development is built.

The goal is simple:

Improve one communication skill every day through deliberate practice, coaching, implementation, and repetition.

Daily Workout is Cognify’s primary long-term training system. It serves as the foundation of communication development by continuously selecting the highest-impact communication skills to practice based on the user’s Communication Profile. Rather than allowing users to build their own workouts, Cognify intelligently determines what they should train next to maximize long-term communication improvement.

---

## **5.2 Daily Workout Structure**

Each Daily Workout focuses on a single Core Skill.

Examples:

* Clarity Day  
* Structure Day  
* Conciseness Day  
* Thinking Quality Day  
* Pacing Day  
* Tone Day

Each workout consists of three exercises.

Every exercise follows the Cognify Training System defined in Section 4\.

Exercise 1

* Prompt Selection with a tid bit of coach insights  
* First Rep  
* Coach Feedback  
* Retry  
* Improvement Review

↓

Exercise 2

* Prompt Selection with a tid bit of coach insights  
* First Rep  
* Coach Feedback  
* Retry  
* Improvement Review

↓

Exercise 3

* Prompt Selection with a tid bit of coach insights  
* First Rep  
* Coach Feedback  
* Retry  
* Improvement Review

↓

Workout Complete

The objective is not simply to complete exercises.

The objective is to accumulate multiple improvement cycles around a single Core Skill.

By the end of a workout, users should feel that they meaningfully improved one communication skill rather than briefly touching multiple skills.

---

## **5.3 Workout Rotation System**

Daily Workout uses a rotating skill system.

Only one Core Skill is trained per workout.

### **Initial Rotation**

New users progress through the six Core Skills in a fixed sequence:

Clarity

↓

Structure

↓

Conciseness

↓

Thinking Quality

↓

Pacing

↓

Tone

↓

Repeat

This ensures exposure to all six Core Skills and allows Cognify to establish an initial performance baseline.

### **Why Rotation Exists**

Communication skills improve faster when attention is concentrated.

Training all six Core Skills simultaneously creates cognitive overload and makes it difficult for users to identify what they are actually improving.

By isolating one Core Skill per workout, users can:

* Focus on one improvement objective  
* Build stronger awareness  
* Practice more intentionally  
* Develop skills more effectively

---

## **5.4 Adaptive Rotation**

Once Cognify has collected enough performance data, workout selection becomes adaptive.

### **Balanced Rotation**

Initially, all Core Skills receive similar training volume.

The objective is to establish a reliable performance baseline across all six skills.

### **Weighted Rotation**

As performance data accumulates, Cognify begins adjusting workout frequency.

Skills requiring more development appear more frequently.

### **Weak Skill Prioritization**

Users should spend more time training weaker Core Skills.

Example:

* Clarity: 88  
* Structure: 82  
* Conciseness: 64  
* Thinking Quality: 79  
* Pacing: 90  
* Tone: 85

In this scenario, Conciseness would appear more frequently than the other Core Skills.

### **Strong Skill Maintenance**

Strong skills should never disappear completely.

Users still require periodic reinforcement to maintain strengths and prevent regression.

The objective is not weakness-only training.

The objective is balanced long-term development.

---

## **5.5 Core Skill Framework (Skill Taxonomy)**

Communication is the skill trained by Cognify. This skill can be separated into six, more fundamental subskills, called Core Skills. Each Core Skill is supported by a framework of hidden communication behaviors (“hidden skills”) that power exercise selection, coaching, scoring, personalization, adaptive rotation, and progress tracking.

These hidden skills/behaviors are not exposed to users.

Users train Core Skills. Cognify trains the underlying behaviors.

For example, a user completing a Clarity workout may receive exercises targeting Word Choice, Concreteness, and Audience Awareness. The user never sees these labels. Instead, they complete exercises, receive coaching, and improve their Clarity score.

This approach allows Cognify to maintain sophisticated personalization while keeping the training experience simple and easy to use.

### **Clarity**

The ability to communicate ideas in a way that is immediately understood.

| Hidden skill | What it means |
| ----- | ----- |
| Audience calibration | Matching vocabulary, complexity, and assumptions to the listener’s knowledge level |
| Jargon translation | Replacing technical, tribal, academic, or corporate language with accessible language |
| Vocabulary precision | Choosing the exact word rather than a vague or overbroad one |
| Concreteness | Using tangible examples, images, comparisons, or cases instead of abstractions |
| Idea isolation | Explaining one idea at a time rather than stacking multiple concepts together |
| Definition discipline | Defining key terms before using them heavily |
| Abstraction laddering | Moving smoothly from abstract principle to concrete example, or vice versa |
| Analogy selection | Choosing analogies that simplify rather than distort |
| Example grounding | Making abstract claims understandable through real-world examples |
| Assumption checking | Avoiding unexplained assumptions about what the listener already knows |
| Ambiguity reduction | Removing unclear referents, vague pronouns, fuzzy claims, and “this/that/it” confusion |
| Referential clarity | Making clear what each noun, pronoun, or example refers to |
| Sentence simplicity | Using clean, speakable sentence structures rather than tangled clauses or run-ons |
| Mental-model matching | Explaining from the listener’s current model toward the new model |
| Common-ground creation | Starting from something the listener already understands |
| Signal-to-noise control | Removing distracting side points, verbal clutter, and unnecessary caveats |
| Listener-first sequencing | Presenting information in the order the listener needs, not the order the speaker thought of it |
| Distinction-making | Clearly separating similar concepts that are easy to confuse |
| Lexical specificity | Replacing “stuff,” “things,” “kind of,” and “a lot” with sharper language |
| Cognitive load reduction | Making the message easy to process by chunking, simplifying, and sequencing |
| Question fidelity | Answering the actual question asked rather than a nearby question |
| Plain-English conversion | Translating expert knowledge into ordinary speech |
| Takeaway clarity | Making the one thing the listener should remember obvious |

### **Structure**

The ability to organize information in a way that is easy to follow.

| Hidden skill | What it means |
| ----- | ----- |
| Bottom-line discipline | Giving the main answer or recommendation early |
| Opening hook | Beginning with a sentence that orients attention and creates relevance |
| Signposting | Using explicit verbal markers: “There are three reasons,” “First,” “The tradeoff is…” |
| Argument hierarchy | Separating main points from supporting details |
| Structural fit | Choosing the right structure for the situation: STAR, BLUF, PREP, Pyramid, AIDA, problem-solution |
| Narrative arc | Creating a clear beginning, tension/change, and resolution |
| STAR fluency | Balancing Situation, Task, Action, Result without drowning in background |
| BLUF fluency | Leading with the conclusion before detail |
| PREP fluency | Making a point, giving a reason, giving an example, and restating the point |
| Pyramid thinking | Starting with synthesis, then grouping supporting arguments |
| MECE grouping | Organizing points so they do not overlap excessively or leave major gaps |
| Chunking | Grouping information into digestible units |
| Transition control | Moving from one idea to the next without abrupt jumps |
| Coherence | Making every part feel connected to the main point |
| Context-ratio control | Giving enough setup, but not so much that the point gets buried |
| Sequence logic | Ordering information chronologically, causally, by importance, or by decision relevance |
| Causal chain construction | Showing how A leads to B leads to C |
| Contrast structure | Organizing around tradeoffs: option A vs. option B |
| Problem-solution framing | Naming the problem, explaining why it matters, then offering a solution |
| Decision framing | Organizing speech around criteria, options, recommendation, and risk |
| Recap and closure | Ending with a clear takeaway rather than trailing off |
| Thread maintenance | Keeping the main thread alive while adding examples or details |
| Listener navigation | Helping the listener always know “where we are” in the response |

### **Conciseness**

The ability to communicate maximum meaning with minimum unnecessary language.

| Hidden skill | What it means |
| ----- | ----- |
| Response scoping | Matching the answer size to the question, audience, and time available |
| Relevance filtering | Including only details that serve the listener’s need |
| Information density | Saying more meaning per word |
| Repetition control | Avoiding saying the same idea multiple ways without added value |
| Filler reduction | Reducing “um,” “uh,” “like,” “you know,” and other low-value verbal padding |
| Hedging control | Reducing unnecessary “kind of,” “sort of,” “maybe,” and “I guess” |
| Real-time editing | Cutting a point while speaking when it becomes unnecessary |
| End discipline | Stopping after the answer is complete |
| Time-box awareness | Speaking within 30, 60, 90, or 120-second constraints |
| Compression | Condensing a complex idea into a shorter form without losing the core meaning |
| Priority selection | Choosing the strongest point instead of listing every possible point |
| Context minimization | Giving only the setup required for the listener to understand |
| Example economy | Using one strong example rather than several weak examples |
| Caveat discipline | Including caveats only when they materially change the claim |
| Qualifier discipline | Avoiding unnecessary softeners that reduce force without increasing accuracy |
| Verbal clutter removal | Removing throat-clearing phrases like “I think what I would say is…” |
| One-point discipline | Making one point well instead of three points poorly |
| Answer-first compression | Starting with the answer, then using detail only if needed |
| Low-value detail deletion | Cutting names, dates, backstory, or process details that do not matter |
| Redundancy detection | Recognizing when a sentence repeats rather than advances the thought |
| Strong close | Ending with a clean final sentence instead of drifting |
| Conversational minimalism | Being brief without sounding cold, evasive, or abrupt |

### **Thinking Quality**

The ability to think critically, support ideas, and communicate reasoning effectively.

| Hidden skill | What it means |
| ----- | ----- |
| Claim clarity | Making the central claim explicit |
| Claim support | Supporting claims with reasons, evidence, examples, or mechanisms |
| Reasoning chain logic | Showing how one idea leads logically to another |
| First-principles reasoning | Grounding an answer in the most basic causes, incentives, constraints, or mechanisms |
| Evidence relevance | Using evidence that actually supports the claim |
| Example validity | Choosing examples that illustrate rather than distract |
| Causal reasoning | Distinguishing correlation, cause, mechanism, and consequence |
| Tradeoff awareness | Naming what is gained and what is sacrificed |
| Counterargument awareness | Recognizing the strongest objection to one’s view |
| Steel-manning | Representing the opposing view fairly before responding |
| Intellectual honesty | Avoiding overclaiming, false certainty, or misleading simplification |
| Epistemic humility | Calibrating certainty to what is actually known |
| Assumption transparency | Naming the assumptions behind the answer |
| Decision criteria | Explaining what standard is being used to judge options |
| Depth of analysis | Moving beyond surface observation into why it matters |
| Implication drawing | Explaining what follows if the claim is true |
| Relevance discipline | Staying responsive to the actual prompt |
| Precision of conclusion | Ending with a nuanced, accurate version of the claim |
| Problem diagnosis | Identifying the real issue beneath the obvious issue |
| Root-cause analysis | Distinguishing symptoms from underlying causes |
| Synthesis | Combining multiple facts or perspectives into a higher-level point |
| Perspective-taking | Considering how different stakeholders would view the issue |
| Probabilistic thinking | Using likelihood, risk, and uncertainty rather than binary certainty |
| Constraint recognition | Noticing practical, ethical, financial, interpersonal, or time constraints |
| Mechanism explanation | Explaining how something works, not just that it works |
| Scope control | Knowing when a claim applies and when it does not |
| Truthfulness under pressure | Maintaining accuracy when trying to sound confident |
| Avoidance of vacuity | Avoiding impressive-sounding but empty language |

### **Pacing**

The ability to control speaking rhythm, timing, and delivery.

| Hidden skill | What it means |
| ----- | ----- |
| Rate awareness | Knowing whether one is speaking too fast, too slow, or appropriately |
| Words-per-minute control | Adjusting speed to the context and listener |
| Strategic pausing (discrete yes/no) | Whether or not pausing is used before or after important points |
| Pause placement (when/where?) | Pausing at idea boundaries rather than randomly |
| Thought-group chunking | Speaking in digestible phrases rather than long streams |
| Rhythm variation | Avoiding monotone cadence by varying speed and intensity |
| Emphasis timing | Slowing or stressing the most important phrase |
| Pressure pacing | Staying controlled when nervous, challenged, or time-limited |
| Silence tolerance | Resisting the urge to fill every pause |
| Filler-to-pause substitution | Replacing “um” and “like” with clean silence |
| Acceleration control | Avoiding speeding up during complex, emotional, or high-stakes moments |
| Deceleration for complexity | Slowing down when the idea is difficult |
| Transition pacing | Briefly pausing before shifting topics |
| Processing-space creation | Giving the listener time to absorb key information |
| Time management | Ending within the assigned time without rushing the final point |
| Recovery pacing | Regaining rhythm after a stumble or correction |
| Cadence control | Developing a controlled, listenable speaking pattern |
| Prosodic alignment | Matching pitch, rhythm, and stress to meaning |
| Emotional tempo | Slowing down during serious moments and energizing during inspiring ones |
| Conversational turn-holding | Using pauses and vocal cues to signal whether one is continuing or finished |
| Monotony avoidance | Preventing flat, same-speed delivery |
| Listener-sensitive pacing | Adjusting speed for novices, non-native speakers, emotional listeners, or technical material |

### **Tone**

The ability to communicate with the appropriate emotional and vocal presence.

| Hidden skill | What it means |
| ----- | ----- |
| Warmth | Sounding humane, approachable, and relationally aware |
| Authority | Sounding credible, decisive, and appropriately firm |
| Confidence | Speaking with grounded assurance rather than bravado |
| Emotional authenticity | Sounding sincere rather than performed or scripted |
| Emotional control | Staying composed under stress, criticism, conflict, or embarrassment |
| Empathy | Acknowledging the listener’s emotional reality |
| Reassurance | Making the listener feel steadier without minimizing their concern |
| Directness | Saying the necessary thing plainly |
| Tact | Being honest without being needlessly harsh |
| Diplomacy | Preserving relationships while addressing tension |
| Accountability | Taking responsibility without self-erasure or defensiveness |
| Nondefensiveness | Responding to critique without sounding attacked |
| Assertiveness | Advocating clearly without aggression |
| Humility | Lowering ego without lowering credibility |
| Gravitas | Matching seriousness with controlled presence |
| Enthusiasm | Showing energy and genuine interest without sounding manic |
| Calmness | Reducing emotional volatility in the room |
| Urgency | Communicating importance without panic |
| Respect | Treating the listener as competent and worthy of consideration |
| Formality calibration | Matching register to setting: casual, professional, ceremonial, clinical, executive |
| Power-distance calibration | Adjusting tone for senior leaders, peers, subordinates, clients, patients, or friends |
| Cultural sensitivity | Avoiding tone choices that may read differently across cultures |
| Warmth-authority balance | Being kind without being weak, and firm without being cold |
| Boundary-setting | Saying no or naming limits clearly and respectfully |
| Conflict de-escalation | Lowering heat while preserving substance |
| Encouragement | Motivating without patronizing |
| Curiosity | Sounding genuinely open rather than performatively neutral |
| Credibility through restraint | Avoiding exaggeration, overselling, or emotional overacting |
| Congruence | Making words, voice, and emotional stance align |
| Listener safety creation | Making it easier for the listener to receive difficult information |

### **How The Framework Is Used**

The Hidden Behavior Framework serves as the underlying system powering Daily Workout.

Users never directly select, view, or train Hidden Behaviors. Instead, Cognify uses them behind the scenes to drive the training experience.

#### **Exercise Generation**

Every exercise is tagged to one or more Hidden Behaviors.

Example:

Clarity Exercise:  
 “Explain blockchain to a 10-year-old.”

Tags:

* Clarity  
* Audience Awareness  
* Concreteness

This allows Cognify to intentionally train specific behaviors while keeping the experience simple for users.

#### **Coaching**

Coach Feedback should be generated partially from Hidden Behavior performance.

Example:

If a user performs poorly on Audience Awareness, feedback may say:

You explained the concept using technical language that assumed prior knowledge. Simplify the explanation and focus on what the listener actually needs to understand.

The user sees Clarity coaching.

The system recognizes Audience Awareness.

#### **Retry Generation**

The Retry should focus on improving the weakest Hidden Behavior identified during the First Rep.

Example:

Weakest Behavior:  
 Audience Awareness

Retry Goal:

Explain the concept again as if speaking to someone with no prior knowledge.

#### **Exercise Selection**

When generating a workout, Cognify should select exercises that target different Hidden Behaviors within the selected Core Skill.

Example:

Clarity Workout

Exercise 1

* Audience Awareness

Exercise 2

* Precision

Exercise 3

* Concreteness

This creates a more complete workout and avoids repetitive training.

#### **Adaptive Rotation**

Hidden Behavior performance should influence future exercise selection.

Behaviors that consistently score lower should appear more frequently.

Behaviors that consistently score higher should appear less frequently but still receive periodic reinforcement.

#### **Progress Tracking**

Progress should be tracked at both levels:

Visible:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

Internal:

* Hidden Behavior Performance

This allows Cognify to personalize training without exposing unnecessary complexity to users.

### **Design Decisions**

* Hidden Behaviors are not visible to users.  
* Users train Core Skills rather than individual behaviors.  
* Exercises are tagged to one or more Hidden Behaviors.  
* Coaching may be generated from Hidden Behavior performance.  
* Retry generation may be influenced by Hidden Behavior performance.  
* Adaptive Rotation uses Hidden Behavior performance data.  
* Progress tracking occurs at both the Core Skill and Hidden Behavior level.  
* New Hidden Behaviors can be added over time without changing the user experience.

---

## **5.6 Prompt Selection**

Users do not choose:

* Core Skills  
* Exercise Categories  
* Difficulty  
* Training Plans

Cognify determines these automatically.

However, users choose the prompt they want to respond to.

For each exercise, Cognify generates six prompts that all train the same communication objective.

Users may:

* Select one of the six prompts  
* Refresh the prompt list  
* Continue refreshing until they find a prompt they want to answer

This provides users with flexibility while ensuring training quality remains consistent.

### **Example**

Exercise Category:

Teach

Prompt Options:

1. Explain cryptocurrency to a 10-year-old.  
2. Explain inflation to a high school student.  
3. Explain WiFi to your grandparents.  
4. Explain AI to a middle school student.  
5. Explain cloud storage to your parents.  
6. Explain Bitcoin to a retiree.

Refresh

↓

Six new prompts

The exercise objective remains the same.

Only the topic changes.

### **Prompt Design Principles**

Prompts should be:

* Interesting  
* Relevant  
* Diverse  
* Easy to understand  
* Appropriate for spoken responses

Prompt topics should span multiple categories such as:

* Business  
* Career  
* Technology  
* Sports  
* Current Events  
* Personal Development  
* Relationships  
* Culture  
* Everyday Life

### **Design Decisions**

* Users choose prompts.  
* Cognify chooses training.  
* Six prompts are displayed at a time.  
* Users may refresh prompts indefinitely.  
* Refreshing changes the topic, not the exercise objective.  
* Prompt variety should increase engagement without compromising training quality.

---

## **5.7 Workout Complete**

After all three exercises have been completed, users reach the Workout Complete screen.

The purpose of this screen is to summarize performance, reinforce improvement, and provide visibility into development.

### **Workout Complete Structure**

Final Communication Score

↓

Workout Improvement

↓

Most Improved Core Skill

↓

Core Skill Breakdown

↓

Coach Recommendation

↓

Reps Earned

### **Final Communication Score**

Displays the user’s overall performance across the workout.

### **Workout Improvement**

Highlights improvement from the beginning of the workout to the end.

Examples:

* Communication Score: \+6  
* Clarity: \+11  
* Structure: \+4

The objective is to make improvement visible.

### **Most Improved Core Skill**

Identifies the Core Skill that improved the most during the workout.

### **Core Skill Breakdown**

Displays current performance across all six Core Skills.

This allows users to understand where strengths and weaknesses currently exist.

### **Coach Recommendation**

Coach Recommendation identifies the next highest-value development opportunity.

Recommendations may include:

* Continue training the current skill  
* Move to the next workout  
* Practice a related communication application in The Lab  
* Spend additional time strengthening a weakness

### **Reps Earned**

Displays total reps completed during the workout and contributes to overall progression throughout Cognify.

---

## **5.8 Success Criteria**

Daily Workout is successful if users:

* Build a consistent training habit  
* Improve over time across the six Core Skills  
* Complete frequent implementation cycles  
* Develop stronger communication fundamentals

The primary outcome of Daily Workout should be measurable improvement in the communication skills that support every other experience inside Cognify.

# 🚂 Daily Work Engine V1

**DAILY WORKOUT PROMPT GENERATION ENGINE V1:**

You are Cognify’s Daily Workout Prompt Architect. Your task is to generate Daily Workout speaking prompts that train one of Cognify’s six Core Skills: Clarity, Structure, Conciseness, Thinking Quality, Pacing, or Tone.

Cognify is a communication gym. The goal is not to teach theory passively, but to create deliberate practice: focused speaking reps, immediate feedback, retry, and measurable improvement.

For each Daily Workout exercise, generate four user-facing prompt options that all train the same Core Skill and the same underlying communication behaviors, while varying the topic so the user can choose which they want to answer.

Each prompt must be:

\* Spoken-response appropriate  
\* Clear in audience, setting, and stakes  
\* Realistic enough to transfer to real-world communication  
\* Focused on one primary communication skill  
\* Challenging but not overwhelming  
\* Suitable for a 60–120 second spoken response

In prompt generation, use communication theory implicitly, not academically. The user should not see references to Aristotle, Grice, Cognitive Load Theory, Minto, Ericsson, or Communication Accommodation Theory. Instead, translate those theories into practical speaking challenges. While supporting the prompts with generated Hidden Behaviors,  while preparing to analyze responses with the Scoring Lens, and while brainstorming Retry Instructions, communication theory may be explicitly and academically referenced.

When generating the exercise, include:

1\. Core Skill:  
   Choose one: Clarity, Structure, Conciseness, Thinking Quality, Pacing, or Tone.

2\. Hidden Behavior:  
   Select one or more underlying behaviors within that skill.

Examples:

\* Clarity: audience awareness (in terms of intelligence, tribal knowledge, vocabulary, or jargon), concreteness, precision, idea isolation  
\* Structure: bottom-line discipline, signposting, argument hierarchy, narrative arc, use of evidence-based communication structures such as STAR, BLUF, PREP, etc.  
\* Conciseness:  response scoping, repetition control, information density, time constraint, filler elimination (in terms of retries)  
\* Thinking Quality: claim support, first-principles reasoning, counterargument awareness (including acknowledgement and potential counters), intellectual honesty, epistemic humility  
\* Pacing: strategic pausing, rate awareness, rhythm variation, pressure management, emphasis  
\* Tone: appropriate tone for context (i.e., warmth), confidence, emotional authenticity, authority, emotional control, emphasis

3\. Coach’s Insight:  
   Write one short coaching cue the user should read before speaking. It should be specific, memorable, and immediately usable. Do not explain theory. Give a behavior to perform.

4\. Four Prompt Options:  
   Generate four different user-facing prompts. Each should train the same Core Skill and Hidden Behaviors, but use a different topic or scenario.

Each prompt should be as concise as possible, written as one single sentence, while including:

\* The audience  
\* A situation  
\* Response timing, length, or other speaking constraint  
\* Any tone, structure, or content constraint needed to train the skill

5\. Scoring Lens:  
   Briefly state what the AI coach should evaluate in the user’s response.

6\. Retry Instruction:  
   After noting potential feedback based on common missteps, generate brief retry instructions that ask the user to attempt the same prompt again while improving the single highest-leverage behavior.

Design principles:

\* Each prompt should make one communication failure visible.  
\* For the user, speaking (during reps) is more important for their skill acquisition than reading (before and after reps).  
\* One skill should be focused on at a time.  
\* The prompt and feedback should create an impetus for implementation of communication skills, not just awareness of those skills or of the user's misstep.  
\* The retry should focus on one highest-leverage behavioral change.  
\* The prompt should be grounded in real communication contexts.  
\* Variety should support transfer, not randomness.  
\* The user experience should feel simple, even if the training design is sophisticated.

# Example Output (Clarity)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Core Skill: Clarity*

*Hidden Behavior:*  
*Audience awareness, concreteness, idea isolation, and precision.*

**Coach’s Insight:**  
**Start with the version your listener can understand, not the version that proves how much you know.**

**Example prompts:**

1. **Explain AI to a grandparent who has heard the term but does not understand it, using one concrete analogy and avoiding technical jargon in a 60–90 second response.**  
2. **Explain compound interest to a high school student deciding whether to open a savings account, using simple language and one everyday example in under 90 seconds.**  
3. **Explain what medical school actually involves to a family friend who thinks it is basically like college, making the main difference clear in a 60–120 second response.**  
4. **Explain cloud storage to a coworker who keeps losing files on their computer, using plain physical language and no more than two main ideas in under 90 seconds.**

*Scoring Lens:*  
*Evaluate whether the speaker calibrated vocabulary to the audience, avoided unexplained jargon, used concrete examples, isolated one idea at a time, and reduced listener cognitive load; this draws on audience accommodation, Grice’s maxim of manner, and Cognitive Load Theory.*

*Retry Instruction:*  
*If the response was too abstract, too technical, or crowded with ideas, retry by opening with the simplest possible explanation, using one concrete analogy, and cutting any detail the listener does not need yet.*

*\[Self note: Write prompts here\]*

# Example Output (Structure)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Core Skill: Structure*

*Hidden Behavior:*  
*Bottom-line discipline, signposting, argument hierarchy, and PREP/BLUF-style organization.*

**Coach’s Insight:**  
**Give the listener the point first, then make the path easy to follow.**

**Four Prompt Options:**

1. **Tell your manager whether your team should adopt a new project-management tool, giving your recommendation first and supporting it with two clear reasons in 60–90 seconds.**  
2. **Explain to a friend why you chose your current career path, using a clear beginning, turning point, and takeaway in under two minutes.**  
3. **Recommend one restaurant to a group deciding where to eat tonight, opening with your choice and giving three brief reasons in under 90 seconds.**  
4. **Tell a hiring manager about a time you handled a difficult situation, using Situation, Action, and Result without overloading the background in 90–120 seconds.**

*Scoring Lens:*  
*Evaluate whether the speaker leads with a clear point, organizes supporting ideas in a logical hierarchy, uses explicit signposting, avoids burying the main idea, and chooses a structure appropriate to the task; this draws on BLUF, PREP, STAR, Minto’s Pyramid Principle, Grice’s maxim of manner, and cognitive load reduction.*

*Retry Instruction:*  
*If the response wandered, buried the point, or felt like a list of thoughts, retry by opening with the main answer in one sentence, signposting two or three supporting points, and ending with a clear takeaway.*

# Example Output (Conciseness)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Core Skill: Conciseness*

*Hidden Behavior:*  
*Response scoping, information density, repetition control, time constraint, and filler elimination during retry.*

**Coach’s Insight:**  
**Say the useful thing, then stop before you dilute it.**

**Four Prompt Options:**

1. **Tell a busy manager why a deadline needs to move, giving only the reason, impact, and proposed new timeline in under 60 seconds.**  
2. **Explain to a friend why you cannot attend an event tonight, staying warm but direct and avoiding over-explaining in under 45 seconds.**  
3. **Recommend one book, movie, or show to a coworker in 60 seconds, giving only the premise, why it fits them, and why it is worth their time.**  
4. **Answer an interviewer asking “Why are you interested in this role?” with one clear motivation and one supporting example in under 90 seconds.**

*Scoring Lens:*  
*Evaluate whether the speaker scopes the answer appropriately, avoids unnecessary background, controls repetition, maintains high information density, and satisfies Grice’s maxims of Quantity and Relation by saying enough without saying too much.*

*Retry Instruction:*  
*If the response rambled, repeated itself, or added unnecessary justification, retry by limiting yourself to one main point, one supporting detail, and one clean closing sentence.*

# Example Output (Quality)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Core Skill: Thinking Quality*

*Hidden Behavior:*  
*Claim support, first-principles reasoning, counterargument awareness, intellectual honesty, and epistemic humility.*

**Coach’s Insight:**  
**Do not just state what you think; show the reasoning that makes it worth considering.**

**Four Prompt Options:**

1. **Tell a skeptical coworker whether remote work is good or bad for productivity, giving your view, one reason, one limitation, and a balanced conclusion in 90–120 seconds.**  
2. **Explain to a friend whether college is still worth the cost, supporting your answer with one clear principle and acknowledging one serious counterargument in under two minutes.**  
3. **Advise a team deciding whether to adopt AI tools at work, giving one main recommendation, the reasoning behind it, and one risk you would watch in 90–120 seconds.**  
4. **Tell a younger student whether they should follow their passion or choose a practical career path, grounding your answer in first principles and avoiding a simplistic yes-or-no response in under two minutes.**

*Scoring Lens:*  
*Evaluate whether the speaker makes a clear claim, supports it with reasoning rather than assertion, stays relevant to the actual question, acknowledges uncertainty or counterarguments, and avoids sounding either overconfident or vague; this draws on Grice’s maxims of Quality and Relation, Aristotle’s logos, first-principles reasoning, and intellectual humility.*

*Retry Instruction:*  
*If the response sounded opinionated but under-supported, retry by stating your claim in one sentence, explaining the principle behind it, naming one counterargument, and ending with a more precise version of your view.*

# Example Output (Pacing)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Core Skill: Pacing*

*Hidden Behavior:*  
*Strategic pausing, rate awareness, rhythm variation, pressure management, and emphasis.*

**Coach’s Insight:**  
**Do not rush the important part; slow down where you want the listener to think.**

**Four Prompt Options:**

1. **Tell a nervous friend how to prepare for an important interview, using a calm pace, one pause before your main advice, and a reassuring tone in 60–90 seconds.**  
2. **Explain a new workplace policy to a busy team, using clear pauses between each step and emphasizing what changes first in under two minutes.**  
3. **Give a short toast at a friend’s celebration, varying your rhythm between warmth and humor while pausing before the final line in 60–90 seconds.**  
4. **Tell a manager about a mistake you made and how you fixed it, speaking steadily under pressure and pausing before the lesson learned in 90–120 seconds.**

*Scoring Lens:*  
*Evaluate whether the speaker maintains an appropriate speaking rate, uses pauses to separate ideas and emphasize key points, varies rhythm to avoid monotony, stays controlled under pressure, and aligns delivery speed with listener comprehension; this draws on prosody research, cognitive load reduction, strategic silence, and delivery theory.*

*Retry Instruction:*  
*If the response felt rushed, flat, or hard to follow, retry by slowing the first sentence, pausing after each major idea, and deliberately emphasizing the one sentence you most want the listener to remember.*

# Example Output (Tone)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Core Skill: Tone*

*Hidden Behavior:*  
*Warmth, confidence, emotional authenticity, authority, emotional control, and emphasis.*

**Coach’s Insight:**  
**Match the emotional need of the moment before you focus on sounding impressive.**

**Four Prompt Options:**

1. **Tell a teammate they missed an important deadline, staying calm, direct, and respectful while making the impact clear in 60–90 seconds.**  
2. **Reassure a nervous friend before a big presentation, using warmth and confidence without sounding dismissive in under 90 seconds.**  
3. **Explain a difficult decision to your team after choosing not to pursue a popular idea, balancing appreciation with firm leadership in 90–120 seconds.**  
4. **Apologize to a colleague for dropping the ball on a shared task, sounding accountable without becoming overly self-punishing in under 90 seconds.**

*Scoring Lens:*  
*Evaluate whether the speaker’s emotional register fits the audience and stakes, balances warmth with authority, avoids defensiveness or over-softening, uses emphasis to signal sincerity, and maintains credibility through emotionally controlled delivery; this draws on ethos, pathos, Communication Accommodation Theory, and warmth-authority research.*

*Retry Instruction:*  
*If the response sounded too cold, too apologetic, too defensive, or too performative, retry by naming the emotional reality plainly, keeping your voice steady, and choosing one sentence where warmth or authority needs to come through most clearly.*

# Core Skill Subkills

# Core Skills Workout Bank

# Clarity Exercises

**CLARITY** 

**Exercise 1: Explain Like I’m 12**

The rule: Explain your topic as if the listener is a 12-year-old with zero background knowledge. No jargon, no assumed context, no shortcuts.

How it works: The user gets a prompt on any topic and must explain it in language a 12-year-old would immediately understand. Every word has to be accessible. Every concept has to be introduced before it is used. The moment the user reaches for a complex word or assumed context they have broken the rule.

Framework — PREP

1. Point — State the idea simply  
2. Reason — Explain why or how it works  
3. Example — Make it concrete  
4. Point — Restate it to close

Example Prompt: Explain what inflation is.

Example Response:

* Point — Inflation is when things cost more money than they used to.  
* Reason — It happens when there is too much money flowing around and not enough stuff to buy so sellers raise their prices.  
* Example — Imagine a candy bar used to cost one dollar and now it costs two. The candy bar did not change but your dollar buys less of it than it used to.  
* Point — Inflation is basically your money slowly losing its buying power over time.

**Exercise 2: The Analogy Bridge**

The rule: Explain your idea by connecting it to something from everyday life. The analogy has to carry the full explanation on its own.

How it works: The user takes their topic and finds one real-world parallel that a complete stranger would immediately recognize. The analogy is not decoration — it is the explanation. If someone could not understand the idea through the analogy alone it is not strong enough.

Framework — BRIDGE

1. Concept — Name it in one plain sentence  
2. Bridge — Say what it works just like  
3. Connection — Explain what makes them the same  
4. Restate — Land the concept so it now feels familiar

Example Prompt: Explain what a firewall is.

Example Response:

* Concept — A firewall is a security system that controls what can enter or leave your computer network.  
* Bridge — Think of it like a bouncer at the door of a club.  
* Connection — The club is your computer and the bouncer decides who gets in and who gets turned away. Every piece of data trying to enter has to get past the bouncer first. If it looks suspicious it gets blocked before it causes any trouble inside.  
* Restate — A firewall is basically a bouncer for your computer — it lets the right things in and keeps the dangerous things out.

**Exercise 3: No Jargon Allowed**

The rule: Every insider term, acronym, or industry phrase is banned. Find plain language replacements in real time as you speak.

How it works: The user speaks on any topic from their own field or knowledge but the moment a jargon word comes up they must replace it with what that word actually means in plain language. The constraint forces real-time audience awareness on every single sentence.

Framework — FAB

1. Feature — State what it is in plain language  
2. Advantage — Explain what it does  
3. Benefit — Close with why it matters

Example Prompt: Explain what a VC-backed startup means.

Example Response:

* Feature — A VC-backed startup is a young company that got its money from professional investors who fund promising businesses in exchange for owning a piece of them.  
* Advantage — Those investors give the company enough money to hire people, build the product, and grow as fast as possible.  
* Benefit — For the founders it means they can move much faster than if they had to earn every dollar themselves — but it also means investors now own part of their company and expect a massive return.

**Exercise 4: One Point Only**

The rule: Pick one single idea before you start. Build everything around it. Never leave it.

How it works: Before the user starts speaking they identify the one central idea their entire response will be built around. Every sentence must connect back to that idea. The moment they introduce something that does not directly support the central point they have broken the rule.

Framework — POINT

1. Central idea — State your one idea  
2. Reason — Strongest reason it is true  
3. Example — One proof that makes it real  
4. Restate — Close by landing the idea again

Example Prompt: What makes a great manager?

Example Response:

* Central idea — The single thing that makes a great manager is making their people feel genuinely heard.  
* Reason — When people feel heard they work harder, stay longer, and perform better because they trust that their perspectives actually matter.  
* Example — Google’s Project Oxygen found that the number one behavior of their highest rated managers was not technical brilliance — it was being a good listener and communicator.  
* Restate — Everything else a manager can do matters less than this because a team that feels heard is a team that wants to deliver.

**Exercise 5: The Word Budget**

The rule: You have a strict word limit. Say everything you need to say within it. Not a word more.

How it works: The user is given a prompt and a word limit — typically 75 to 100 words. They must communicate their complete idea within that budget. Nothing meaningful can be cut and nothing unnecessary can stay. Every word is a deliberate choice made under real constraint.

Framework — BLUF

1. Conclusion — Lead with your answer  
2. Reason — Most essential support only  
3. Example — One concrete proof  
4. Stop — The moment the point is made

Example Prompt: Why does first impression matter? 75 words maximum.

Example Response:

* Conclusion — First impressions form in under seven seconds and are extraordinarily hard to reverse once made.  
* Reason — The brain makes snap judgments about competence, trustworthiness, and likability almost instantly based on how you look and sound before you have said a single meaningful word.  
* Example — Getting that first moment right does not guarantee success but getting it wrong means spending the entire rest of the interaction fighting a judgment that was already made.

# Structure Exercises

**STRUCTURE — Exercises and Frameworks**

**Exercise 1: The 3 Point Rule**

**The rule:** Organize your entire response into exactly three distinct points. No more, no less.

**How it works:** Before speaking the user identifies exactly three points that support their position. Each point gets its own moment — stated clearly, supported briefly, and closed before moving to the next. The constraint forces prioritization. If the user cannot narrow it to three they have not thought it through enough yet.  
   
**Framework — PREP**  
1\. **Position —** State your position  
2\. **First —** First point plus one supporting detail  
3\. **Second —** Second point plus one supporting detail  
4\. **Third —** Third point plus one supporting detail  
5\. **Position —** Restate your position to close  
   
**Example Prompt:** Why is communication the most important skill in business?  
   
**Example Response:**  
• **Position —** Communication is the most important skill in business because everything else depends on it.  
• **First —** It determines whether your ideas get heard. You can have the best strategy in the room but if you cannot articulate it clearly it dies in the meeting.  
• **Second —** It directly affects how people perceive your competence. Listeners form judgments about intelligence and capability based on how clearly someone speaks before they evaluate the actual content.  
• **Third —** It is the only skill that makes every other skill more valuable. Technical ability, creativity, and leadership all have more impact when the person behind them can communicate effectively.  
• **Position —** Every business outcome runs through communication at some point which is why nothing else compounds the way this skill does.

**Exercise 2: The Story Arc**

**The rule:** Structure any response as a setup, conflict, and resolution. Every response needs a beginning, a tension, and a payoff.  
   
**How it works:** The user takes any topic and finds the narrative arc inside it. The setup establishes context. The conflict introduces the problem or tension. The resolution delivers the answer, outcome, or lesson. If the response does not have all three it is not complete.  
   
**Framework — STAR**  
1\. **Situation —** Set the scene and establish context  
2\. **Task —** Introduce the problem or tension  
3\. **Action —** Walk through what was done or what needs to happen  
4\. **Result —** Close with the outcome or lesson  
   
**Example Prompt:** Tell me about a time communication broke down and what happened.  
   
**Example Response:**  
• **Situation —** A product team spent six months building a feature their users had never asked for.  
• **Task —** The team lead assumed they understood what the customer wanted without ever talking to them directly. Every decision was made internally with no outside input.  
• **Action —** When the feature launched to almost no engagement the company brought in a customer research process that required the team to interview at least ten users before any new feature could move into development.  
• **Result —** The next feature they built had a 40 percent adoption rate in the first month. The only thing that changed was that they started communicating with the people they were building for before they built anything.  
 

**Exercise 3: Bottom Line First**

**The rule:** Your conclusion goes in the first sentence. No warmup, no buildup, no context setting before the point.  
   
**How it works:** The user states their full answer in the opening sentence and then uses everything after it to support what was already said. The listener should know exactly where the response is going from the very first word. If the main point could be moved to the end without changing the response the user has failed the exercise.  
   
**Framework — BLUF**  
1\. **Conclusion —** Lead with your answer in one sentence  
2\. **First reason —** Strongest reason it is true  
3\. **Second reason —** Next most important support  
4\. **Example —** Close with one concrete proof  
   
**Example Prompt:** Should companies allow employees to work remotely?  
   
**Example Response:**  
• **Conclusion —** Companies that offer remote work attract better talent, retain them longer, and in most roles see no decline in output.  
• **First reason —** The talent pool expands dramatically when location is not a constraint. The best person for a role is almost never within commuting distance of the office.  
• **Second reason —** Retention improves because employees with flexibility report higher job satisfaction and are significantly less likely to leave for a competitor.  
• **Example —** Stanford researcher Nicholas Bloom found in a controlled study that remote workers were 13 percent more productive than their in-office counterparts and took fewer sick days.  
 

**Exercise 4: Monroe’s Motivated Sequence**

**The rule:** Move the listener from awareness to action using five steps — Attention, Need, Solution, Visualization, Action.  
   
**How it works:** The user opens by capturing attention, establishes a real need or problem the listener has, presents the solution, helps the listener visualize what life looks like with the solution in place, and closes with a clear call to action. This is the most complete persuasion structure in communication research and is designed for any moment where the goal is to move someone.  
   
**Framework — Monroe’s Motivated Sequence**  
1\. **Attention —** Open with something that makes them care immediately  
2\. **Need —** Establish the problem or gap the listener has  
3\. **Solution —** Present your answer clearly  
4\. **Visualization —** Show what it looks like when the solution works  
5\. **Action —** Close with one clear next step  
   
**Example Prompt:** Convince someone to start exercising regularly.  
   
**Example Response:**  
• **Attention —** Most people spend more time maintaining their car than maintaining their body and then wonder why the body breaks down first.  
• **Need —** Cardiovascular disease is the leading cause of death globally and the majority of cases are directly linked to sedentary lifestyle. The problem is not genetics for most people. It is inactivity.  
• **Solution —** Thirty minutes of moderate exercise five days a week is enough to dramatically reduce your risk and research consistently shows it is also the single most effective intervention for mental health, cognitive performance, and longevity.  
• **Visualization —** Imagine being in your 60s with the energy and clarity you had in your 30s. That is not fantasy — it is the documented outcome for people who maintained consistent physical activity across their lives.  
• **Action —** You do not need a gym membership or a perfect plan. Start with thirty minutes tomorrow and then again the day after. That is it.

# Conciseness Exercises

**CONCISENESS — Exercises and Frameworks**

**Exercise 1: The 30 Second Rule**

**The rule:** You have 30 seconds. Make your complete point within it. Not a second more.  
   
**How it works:** The user is given a prompt and must deliver a complete, meaningful response in 30 seconds or less. The constraint forces instant prioritization — there is no room for warmup, repetition, or over-explanation. Every second counts and the user feels that pressure in real time.  
   
**Framework — BLUF**  
1\. **Conclusion —** Lead with your answer  
2\. **Reason —** Most essential support only  
3\. **Example —** One concrete proof  
4\. **Stop —** The moment the point is made  
   
**Example Prompt:** Why does feedback matter in the workplace?  
   
**Example Response:**  
• **Conclusion —** Feedback is the fastest way to close the gap between where someone is and where they need to be.  
• **Reason —** Without it people repeat the same mistakes because they have no way of knowing what is not working.  
• **Example —** Google’s research on high performing teams found that psychological safety and regular feedback were the two most consistent predictors of team effectiveness.  
• **Stop —** Feedback is not a performance review. It is the daily mechanism that makes people better.  
 

**Exercise 2: Kill the Filler**

**The rule:** Zero filler words. The moment um, uh, like, you know, basically, or literally comes out the rep starts over.  
   
**How it works:** The user speaks on any topic but filler words are completely banned. If one slips out the rep resets. This exercise trains the most measurable conciseness signal — filler word frequency — by making the cost of each one immediate and tangible.  
   
**Framework — POINT**  
1\. **Position —** State your point cleanly  
2\. **One reason —** Support it without hesitation  
3\. **Example —** Make it concrete  
4\. **Position —** Restate to close  
   
**Example Prompt:** What makes a strong first impression?  
   
**Example Response:**  
• **Position —** A strong first impression comes down to how present and confident you appear in the first ten seconds.  
• **One reason —** People form judgments almost instantly based on eye contact, posture, and the steadiness of your voice before they have processed a single word you said.  
• **Example —** Research from Princeton found that competence and trustworthiness judgments form in less than 100 milliseconds and are remarkably consistent with longer evaluations.  
• **Position —** You cannot undo a first impression so the work happens before you walk in the room.  
   
  

**Exercise 3: The Hard Stop**

**The rule:** The moment your point is fully made you stop. No summary, no wrap-up, no restatement. Just stop.  
   
**How it works:** The user delivers their response and must recognize the exact moment the point is complete and end there. No closing remarks, no circling back, no final sentence that restates what was already said. This trains response scoping — one of the most underrated and most common conciseness failures. Most people do not over-explain because of filler or hedging. They just keep talking after the point is already made.  
   
**Framework — BLUF**  
1\. **Conclusion —** Lead with your answer  
2\. **Reason —** The single most important reason  
3\. **Example —** One concrete proof  
4\. **Stop —** Do not say another word  
   
**Example Prompt:** Why is consistency important in communication?  
   
**Example Response:**  
• **Conclusion —** Consistent communicators are trusted more because people know what to expect from them.  
• **Reason —** When someone’s message, tone, and follow-through are predictable it removes the anxiety of trying to read them and lets the other person focus on the content instead.  
• **Example —** Research on leadership effectiveness consistently shows that perceived consistency is one of the strongest predictors of team trust — stronger than charisma, technical skill, or seniority.

# Thinking Quality Exercises

**THINKING QUALITY — Exercises and Frameworks**

**Exercise 1: The Claim and Proof**

**The rule:** Every claim you make must be proven in the same breath. No assertion can float without a reason, evidence, or specific example underneath it.  
   
**How it works:** The user cannot state anything they cannot immediately back up. The moment a claim leaves their mouth the next words must be the proof. This trains the habit of grounding every assertion before moving on — which is the most fundamental thinking quality skill.  
   
**Framework — POINT**  
1\. **Claim —** State your assertion  
2\. **Proof —** Back it immediately with evidence, a reason, or a specific example  
3\. **Claim —** State the next assertion  
4\. **Proof —** Back that one immediately  
5\. **Close —** Land the overall point now that it is fully supported  
   
**Example Prompt:** Why is sleep important for performance?  
   
**Example Response:**  
• **Claim —** Sleep is the single most important recovery tool the human body has.  
• **Proof —** Research shows that after 20 hours without sleep cognitive performance drops to the equivalent of being legally drunk.  
• **Claim —** Your brain uses sleep to consolidate everything you learned that day.  
• **Proof —** Without that consolidation window the memories do not stick — which means the work you put in during the day gets lost if you do not sleep after it.  
• **Close —** Sleep is not a luxury. It is the mechanism your brain uses to turn effort into actual capability.  
 

**Exercise 2: The Steel Man**

**The rule:** Before giving your own position you must first argue the strongest possible version of the opposing view.  
   
**How it works:** The user is given a prompt with a clear position or debate. Before stating their own view they must construct and articulate the strongest possible case for the other side. Not a weak version they can easily knock down — the best version. Only then can they give their own position. This trains the ability to engage with complexity rather than avoid it.  
   
**Framework — STEEL**  
1\. **Steel —** Argue the strongest version of the opposing view  
2\. **Transition —** Signal that you are now giving your own position  
3\. **Own position —** State your view clearly  
4\. **Reason —** Give your strongest supporting reason  
5\. **Close —** Land your position with conviction  
   
**Example Prompt:** Is working hard more important than working smart?  
   
**Example Response:**  
• **Steel —** The strongest case for hard work is real. Every elite performer across every field has put in volume that most people are not willing to match. Talent without effort is potential that never becomes anything. The 10000 hour rule exists because there is no substitute for repetition and the people who outwork everyone else consistently end up ahead.  
• **Transition —** That said the evidence points somewhere more nuanced.  
• **Own position —** Working smart matters more in the long run because effort without direction compounds in the wrong direction.  
• **Reason —** Two people can put in the same hours and end up in completely different places based solely on whether their effort was pointed at the right things. Hard work is the engine but strategy is the steering wheel.  
• **Close —** Work hard enough to be dangerous. Work smart enough to make sure it is pointed somewhere worth going.  
   
 

**Exercise 3: The So What Test**

**The rule:** Every point you make must answer the question so what before you move on.  
   
**How it works:** The user cannot make a statement and leave it sitting there. Every point must be developed to the level of so what — why does this matter, what does it mean, what should the listener think or do differently as a result. This trains depth of analysis which is the most common thinking quality failure. Most speakers stop at what when the real value lives at so what.  
   
**Framework — DEPTH**  
1\. **Point —** State your claim  
2\. **So what —** Explain why it matters and what it means  
3\. **Example —** Make it concrete  
4\. **So what again —** Close with the implication or takeaway  
   
**Example Prompt:** Why do habits matter?  
   
**Example Response:**  
• **Point —** Most of what people do every day is not a conscious decision — it is a habit running on autopilot.  
• **So what —** This means that if you want to change your outcomes you cannot just rely on willpower or motivation because those are not what is driving most of your behavior. You have to change the system not just the intention.  
• **Example —** Research by Wendy Wood at USC found that approximately 43 percent of daily behaviors are performed habitually in the same location and at the same time each day — not because people chose to in the moment but because the behavior had been automated.  
• **So what again —** The most important thing you can do for your long term performance is not to try harder. It is to design your environment and routines so that the right behaviors happen automatically without requiring any decision at all.  
 

**Exercise 4: The Perspective Shift**

**The rule:** Argue the prompt from a perspective that is not your own — a different role, age group, industry, or worldview.  
   
**How it works:** The user is given a prompt and must respond from the explicit perspective of someone with a fundamentally different vantage point than their own. This trains perspective taking — the ability to genuinely inhabit a different point of view rather than just acknowledging it exists. It produces more original and more well-rounded thinking than responding from a single fixed viewpoint.  
   
**Framework — LENS**  
1\. **Establish the lens —** Name the perspective you are arguing from  
2\. **Build —** Develop the position from inside that perspective genuinely  
3\. **Insight —** Pull out the key insight this perspective reveals  
4\. **Bridge —** Connect it back to the original question with your own synthesis  
   
**Example Prompt:** Why do people struggle to ask for help?  
   
**Example Response:**  
• **Lens —** From the perspective of a therapist who works with high achievers the answer has almost nothing to do with pride and everything to do with identity.  
• **Build —** High performers build their entire sense of self around being capable and competent. Asking for help signals to them — and they fear to others — that they are not. The ask itself feels like evidence of inadequacy rather than evidence of intelligence.  
• **Insight —** The irony is that the people who are most capable of achieving things are often the ones most paralyzed by the fear of being seen as incapable. The very trait that drives their success is the same one that makes asking for help feel threatening.  
• **Bridge —** People do not struggle to ask for help because they are proud. They struggle because asking requires them to briefly become someone they have worked very hard not to be.  
 

# Pacing Exercises

**PACING — Exercises and Frameworks**

**Exercise 1: The Metronome**

**The rule:** Speak at a deliberate, controlled rate from the first word to the last. No rushing, no dragging. Every sentence gets the same intentional pace.  
   
**How it works:** The user delivers their response with full awareness of their rate of speech. The goal is to stay within the optimal range of 150 to 160 words per minute throughout the entire rep. This is not about slowing down artificially — it is about removing the unconscious speed fluctuations that happen when speakers stop thinking about how fast they are talking. Rate awareness is the foundation of all other pacing skills.  
   
**Framework — BLUF**  
1\. **Conclusion —** Lead with your answer at a controlled pace  
2\. **Reason —** Deliver support without rushing  
3\. **Example —** Ground it concretely  
4\. **Close —** Land the final sentence deliberately and stop  
   
**Example Prompt:** Why is practice more important than talent?  
   
**Example Response:**  
• **Conclusion —** Practice beats talent in almost every domain when the talent does not also practice.  
• **Reason —** Talent sets a ceiling but practice determines how close you get to it. Most people with exceptional natural ability coast until someone who outworks them catches up and passes them.  
• **Example —** Anders Ericsson spent decades studying elite performers across chess, music, sports, and medicine and found that deliberate practice — not innate ability — was the single most consistent predictor of reaching the top of any field.  
• **Close —** Talent is a head start. Practice is the race.  
 

**Exercise 2: The Strategic Pause**

**The rule:** Pause before your most important point to build anticipation. Pause after it to let it land. Never fill either silence with a filler word.  
   
**How it works:** The user delivers their response using two types of deliberate silence. A pause before the key point signals to the listener that something important is coming and makes them lean in. A pause after the key point gives the listener’s brain the processing window it needs to consolidate what was just said before the next idea arrives. Together they make the most important moment in the response feel like the most important moment in the response.  
   
**Framework — POINT**  
1\. **Position —** State your opening point  
2\. **Pause —** Hold before the key idea  
3\. **Key idea —** Deliver the most important sentence  
4\. **Pause —** Hold after it lands  
5\. **Reason —** Continue with support  
6\. **Close —** Land the final sentence  
   
**Example Prompt:** Why does confidence matter in communication?  
   
**Example Response:**  
• **Position —** Confidence changes how people receive everything you say.  
• **Pause —** \[hold silence\]  
• **Key idea —** When you deliver words with conviction the listener’s brain registers them as credible before it has even processed the content.  
• **Pause —** \[hold silence\]  
• **Reason —** Research from Quantified Communications found that executives who used fewer filler words were rated 33 percent more persuasive even when the content of their speech was identical to a filler-heavy version.  
• **Close —** Confidence is not about being loud. It is about delivering your words like you believe them which makes the listener believe them too.  
 

**Exercise 3: Silence Over Filler**

**The rule:** Every time you would normally reach for a filler word you replace it with silence instead.  
   
**How it works:** The user delivers their response but the moment they feel the urge to say um, uh, like, or you know they must close their mouth and pause instead. The silence replaces the filler. This is harder than it sounds because filler words are deeply habitual and the discomfort of silence is what drives most people to use them in the first place. This exercise trains the speaker to get comfortable with silence as a tool rather than a threat.  
   
**Framework — PREP**  
1\. **Point —** State your idea  
2\. **Replace —** Every filler impulse becomes a pause  
3\. **Reason —** Continue with your support after the pause  
4\. **Example —** Ground it concretely  
5\. **Point —** Restate to close  
   
**Example Prompt:** What makes someone a good communicator?  
   
**Example Response:**  
• **Point —** Good communicators make the listener feel like the most important person in the room.  
• **Replace —** \[pause instead of filler\]  
• **Reason —** They speak clearly, they listen actively, and they adjust what they are saying in real time based on how the person in front of them is responding. That combination is rarer than most people think.  
• **Example —** Think about the best conversation you have ever had. The other person was probably not the most impressive speaker in the room. They were the one who made you feel most understood.  
• **Point —** Communication is not about performing. It is about connecting. And connection requires presence not polish.  
 

**Exercise 4: The Speed Shift**

**The rule:** Intentionally slow down on the most important sentence in your response. Everything else moves at a normal pace. The key point gets half the speed.  
   
**How it works:** The user delivers their full response at a normal controlled rate but identifies the single most important sentence before the rep starts. When they arrive at that sentence they slow down significantly. This trains the skill of using pace as emphasis. Slowing down on a key point signals to the listener that what is being said right now matters more than everything else. It is one of the most powerful and most underused delivery tools available to a speaker.  
   
**Framework — BLUF**  
1\. **Conclusion —** Deliver at normal pace  
2\. **Reason —** Deliver at normal pace  
3\. **Key point —** Slow down significantly here  
4\. **Example —** Return to normal pace  
5\. **Close —** Deliver at normal pace  
   
**Example Prompt:** What is the biggest mistake people make in job interviews?  
   
**Example Response:**  
• **Conclusion —** The biggest mistake people make in job interviews is answering the question they were asked instead of the question behind the question.  
• **Reason —** Every interview question is really asking one of three things — can you do the job, will you fit the culture, or are you someone we want to work with every day.  
• **Key point —** \[slow\] The candidates who win are the ones who understand what is actually being evaluated and speak to that directly rather than just giving a technically correct answer.  
• **Example —** When someone asks where do you see yourself in five years they are not asking about your career plan. They are asking whether you are ambitious, self-aware, and planning to mstay.  
• **Close —** Answer the real question and you will almost always outperform the candidate who just answered the one they heard.

**Exercise 5: The Rhythm Check**

**The rule:** Vary your pace intentionally throughout the response. Speed up to build momentum. Slow down to land importance. Never stay at the same rate for more than two consecutive sentences.  
   
**How it works:** The user delivers their response with deliberate variation in speed across the entire rep. Fast sentences create energy and momentum. Slow sentences create weight and emphasis. The goal is to use pace as a tool for guiding listener attention — speeding through context and background, slowing down on the ideas that matter most. A flat unchanging rate is as disengaging as a monotone voice.  
   
**Framework — PREP**  
1\. **Point —** Deliver at a controlled pace  
2\. **Reason —** Build pace slightly as you develop the argument  
3\. **Example —** Slow down as you arrive at the concrete detail  
4\. **Point —** Deliver the close at the slowest and most deliberate pace of the rep  
   
**Example Prompt:** Why is consistency the key to building any skill?  
   
**Example Response:**  
• **Point —** Consistency is the only variable that separates people who get good at things from people who stay average at them.  
• **Reason —** Talent determines your starting point. Effort on any given day determines how hard you work. But consistency determines whether the effort compounds over time into something that actually changes what you are capable of. Most people have the ability. Most people do not have the consistency.  
• **Example —** \[slow\] Every study on skill acquisition shows the same thing — it is not the intensity of the practice session that predicts mastery. It is the frequency and the duration across months and years.  
• **Point —** \[slowest\] You do not get good by training hard once. You get good by showing up when it does not feel worth it.

 

# Tone Exercises

**TONE — Exercises and Frameworks**

**Exercise 1: The Monotone Breaker**

**The rule:** Every sentence must sound different from the one before it. No two consecutive sentences can be delivered at the same pitch and volume.  
   
**How it works:** The user delivers their response but must intentionally vary their pitch and volume on every single sentence. This is the most direct exercise for breaking flat delivery — the most common and most damaging tone failure. The goal is not to sound performative or exaggerated. It is to build the habit of vocal variation so that it becomes automatic rather than something the speaker has to consciously force.  
   
**Framework — PREP**  
1\. **Point —** Deliver at a strong baseline pitch and volume  
2\. **Reason —** Shift pitch or volume noticeably on this sentence  
3\. **Example —** Drop pitch and volume to draw the listener in  
4\. **Point —** Lift back up on the close to land with energy  
   
**Example Prompt:** Why does body language matter?  
   
**Example Response:**  
• **Point —** Body language is communicating something whether you intend it to or not. \[strong baseline\]  
• **Reason —** The brain processes physical signals simultaneously with words which means the listener is forming impressions about your confidence and credibility before you have finished your first sentence. \[pitch shifts up slightly\]  
• **Example —** Research consistently shows that when verbal and nonverbal signals conflict listeners trust the nonverbal signal almost every time. \[drop pitch and volume, draw them in\]  
• **Point —** You are always saying more than your words. The question is whether what your body is saying is working for you or against you. \[lift back up, land with energy\]  
 

**Exercise 2: The Volume Dial**

**The rule:** Intentionally increase your volume on the most important word in each sentence. Not every word — just the one that carries the most weight.  
   
**How it works:** The user delivers their response but before each sentence identifies the single most important word and emphasizes it with a noticeable increase in volume. This trains the skill of vocal emphasis — using volume as a guide for listener attention. Speakers who emphasize nothing sound flat and equal. Speakers who emphasize the right words guide the listener to exactly what matters.  
   
**Framework — BLUF**  
1\. **Conclusion —** Identify the key word and hit it  
2\. **First reason —** Emphasize the most important word  
3\. **Second reason —** Do the same  
4\. **Example —** Land the concrete detail with emphasis on the most specific word  
5\. **Close —** Hit the final key word hardest  
   
**Example Prompt:** What separates average communicators from great ones?  
   
**Example Response:**  
• **Conclusion —** Great communicators do not just say things clearly — they make you FEEL like what they are saying matters.  
• **First reason —** Average speakers treat every word as equal. Great ones know which words to LAND and which to let pass.  
• **Second reason —** The difference is almost never in the content. It is in the DELIVERY of the content.  
• **Example —** Think of the last time someone genuinely moved you with their words. They were almost certainly not the most ARTICULATE person in the room — they were the most INTENTIONAL.  
• **Close —** Communication is not just about what you say. It is about what the listener REMEMBERS.  
 

**Exercise 3: The Warmth Switch**

**The rule:** Deliver your response as if you genuinely care about the person listening. Every sentence must sound like it is being said to someone you respect and want to help.  
   
**How it works:** The user delivers their response with a conscious focus on vocal warmth — the quality of tone that makes a listener feel like the speaker is engaged, present, and invested in them. This is not about being soft or overly friendly. It is about removing the clinical, detached, or performative quality that creeps into delivery when speakers focus too much on their content and not enough on their listener. The AI measures this through vocal variety, pitch softness, pace, and smoothness — the acoustic fingerprint of warm delivery.  
   
**Framework — POINT**  
1\. **Position —** Deliver with full presence and engagement  
2\. **Reason —** Speak as if the reason genuinely matters to the person listening  
3\. **Example —** Make the example feel personal and real  
4\. **Position —** Close like you want them to actually take this with them  
   
**Example Prompt:** Why is it important to listen more than you speak?  
   
**Example Response:**  
• **Position —** The most underrated communication skill is not speaking well — it is making the other person feel genuinely heard.  
• **Reason —** When people feel listened to they open up, they trust more, and they are far more likely to receive what you have to say when it is your turn. Listening is not passive. It is the most powerful thing you can do in a conversation.  
• **Example —** Think about the last time someone really listened to you — not waiting to respond, not half present, but actually tracking every word. It is rare enough that you probably remember exactly who it was.  
• **Position —** The irony is that the people who speak the least in a room often leave the biggest impression. Not because of what they said but because of how they made everyone else feel.  
 

**Exercise 4: The Authority Voice**

**The rule:** Every statement must be delivered with full conviction. No trailing off, no softening, no apologetic tone. You believe everything you are saying and your voice must reflect that.  
   
**How it works:** The user delivers their response with deliberate vocal authority — steady volume, downward inflection, controlled pace, and no vocal apologetics. This exercise directly targets the habits that undermine perceived credibility — trailing off at the end of sentences, dropping volume on important points, or delivering opinions with the vocal quality of a question. Authority is not about being aggressive. It is about sounding like someone who has thought through what they are saying and stands behind it completely.  
   
**Framework — BLUF**  
1\. **Conclusion —** State it like it is fact  
2\. **First reason —** Deliver with full conviction  
3\. **Second reason —** Same energy, same commitment  
4\. **Example —** Ground it and hold the authority through the close  
5\. **Close —** Final sentence is the most convicted of all  
   
**Example Prompt:** Should people speak up more in meetings?  
   
**Example Response:**  
• **Conclusion —** People who do not speak up in meetings are invisible regardless of how good their thinking is.  
• **First reason —** Decisions get made by the people in the room who express a view. Silence is not neutrality — it is absence from the conversation that shapes outcomes.  
• **Second reason —** How you show up vocally in a room is how leadership identifies who is ready for more responsibility.  
• **Example —** Research on workplace visibility consistently shows that perceived contribution — not actual contribution — is what drives recognition and advancement. If no one hears your thinking it does not exist professionally.  
• **Close —** Speaking up is not about being the loudest. It is about making sure your thinking is in the room where it can actually do something.  
 

**Exercise 5: The Downward Landing**

**The rule:** Every statement must end with a downward inflection. No upspeak, no trailing off, no rising pitch at the end of a declarative sentence. Every point lands like a period not a question mark.  
   
**How it works:** The user delivers their response but must consciously drop their pitch at the end of every statement. Upward inflection at the end of a declarative sentence signals uncertainty and undermines credibility before the listener has even evaluated the content. Downward inflection signals conviction and authority. This is one of the most common and most damaging delivery habits among young professionals and one of the most trainable with focused repetition. The AI measures the ratio of downward to upward inflection at the end of statements as a direct tone signal.  
   
**Framework — BLUF**  
1\. **Conclusion —** State it and drop the pitch at the end  
2\. **First reason —** Land it with downward inflection  
3\. **Second reason —** Land it the same way  
4\. **Example —** Ground it and close the pitch down  
5\. **Close —** Final sentence drops hardest of all  
   
**Example Prompt:** Why should people invest in their communication skills?  
   
**Example Response:**  
• **Conclusion —** Communication is the skill that makes every other skill more valuable and most people never deliberately train it. \[pitch drops\]  
• **First reason —** Your ideas are only as good as your ability to express them. The best thought in the room dies if it cannot be articulated clearly. \[pitch drops\]  
• **Second reason —** Research consistently shows that communication ability is the strongest predictor of career advancement — stronger than technical skill, stronger than credentials, stronger than experience. \[pitch drops\]  
• **Example —** A study by LinkedIn found that communication skills are the number one most in-demand soft skill across every industry every single year. \[pitch drops\]  
• **Close —** You can get smarter, more experienced, and more technically skilled — but none of it compounds the way communication does. \[pitch drops hardest\]  
 

**Exercise 6: The Emotional Dial**

**The rule:** Match the emotional weight of your content with the emotional quality of your voice. Light content gets a lighter tone. Heavy content gets a heavier one.  
   
**How it works:** The user delivers their response with deliberate attention to emotional congruence — making sure the tone of their voice matches the emotional weight of what they are saying. Speakers who discuss serious topics in a flat tone, or important ideas in a casual throwaway voice, create a mismatch that makes the listener distrust either the content or the speaker. Emotional congruence is what makes communication feel authentic and the AI measures it through the alignment between vocal energy level and content weight.  
   
**Framework — PREP**  
1\. **Point —** Set the emotional register that matches the content  
2\. **Reason —** Maintain that register as you develop the idea  
3\. **Example —** If the example is serious let the voice reflect that  
4\. **Point —** Close at the emotional register the content deserves  
   
**Example Prompt:** Why do people fear public speaking?  
   
**Example Response:**  
• **Point —** The fear of public speaking is not really about speaking — it is about being judged and found wanting in front of people whose opinion matters to you. \[serious, grounded tone\]  
• **Reason —** Social rejection activated the same neural pathways as physical pain in early humans. Being cast out from the group meant death. That ancient wiring has not gone anywhere — it just shows up now as stage fright instead of survival fear. \[weight in the voice, slower\]  
• **Example —** Jerry Seinfeld once joked that at a funeral most people would rather be in the casket than giving the eulogy. The joke lands because the fear it describes is completely real to almost everyone who hears it. \[slightly lighter to honor the humor then return to gravity\]  
• **Point —** Understanding that the fear is ancient and physiological is the first step to working with it instead of being controlled by it. \[steady, grounded close\]  
 

**Exercise 7: The Resonance Rep**

**The rule:** Speak from your chest not your throat. Every sentence must be delivered with full vocal resonance — deep, steady, and projected.  
   
**How it works:** The user delivers their response with deliberate attention to where their voice is coming from physically. Chest voice produces lower, more resonant, more authoritative sound. Throat voice produces higher, thinner, less credible sound. Most people default to throat voice under pressure — especially when nervous or rushing. This exercise builds the physical habit of chest resonance which is the foundation of vocal presence and the most detectable acoustic signal of authority.  
   
**Framework — BLUF**  
1\. **Conclusion —** Project from the chest  
2\. **First reason —** Maintain full resonance through the support  
3\. **Second reason —** Do not let the voice thin out here  
4\. **Example —** Ground it with the same resonance  
5\. **Close —** Deepest and most resonant sentence of the rep  
   
**Example Prompt:** Why is vocal presence important in leadership?  
   
**Example Response:**  
• **Conclusion —** A leader whose voice does not carry authority loses the room before they have made a single point.  
• **First reason —** Vocal presence is the first signal people use to calibrate whether someone is worth listening to. It is not fair and it is not conscious — it is how human perception works.  
• **Second reason —** A thin or uncertain voice creates doubt in the listener’s mind regardless of how strong the content is. The voice is always communicating something about the speaker’s internal state and the listener is always reading it.  
• **Example —** Research on perceived leadership effectiveness consistently shows that speakers with lower more resonant voices are rated as more credible, more dominant, and more trustworthy — even when the content of what they say is held constant.  
• **Close —** Your voice is an instrument. Most people never learn to play it. The ones who do have an advantage that almost no one else is training for.

# Core Skill Prompt Bank

# Clarity Prompts

**CLARITY — Prompt Bank**

**Exercise 1: Explain Like I’m 12**  
Strip any topic down to its simplest form using only language a 12-year-old would understand.

1. Explain what a habit is and how it forms  
2. Explain what anxiety feels like  
3. Explain what culture shock is  
4. Explain what burnout is  
5. Explain what FOMO is  
6. Explain what it means to be in a flow state  
7. Explain what stage fright is  
8. Explain what Instagram is  
9. Explain how to drive a car  
10. Explain what a credit card is  
11. Explain how a resume works  
12. Explain what a lease is  
13. Explain what a password manager is  
14. Explain what meal prepping is  
15. Explain what a savings account does  
16. Explain what a hangover is  
17. Explain what intermittent fasting is  
18. Explain what a red flag is  
19. Explain what a gap year is  
20. Explain what a side effect is  
21. Explain what a warranty is  
22. Explain what a background check is  
23. Explain what a guilty pleasure is  
24. Explain what a stereotype is  
25. Explain what a boundary is  
26. Explain what a tab is at a bar  
27. Explain what procrastination is  
28. Explain what a budget is  
29. Explain what an unwritten rule is  
30. Explain what a rite of passage is  
31. Explain what a learning curve is  
32. Explain what a milestone is

**Exercise 2: The Analogy Bridge**

Explain your idea by connecting it to something from everyday life that carries the full explanation.

1. Explain what it means to be in a flow state.  
2. Explain what it feels like to be overwhelmed  
3. Explain what momentum feels like  
4. Explain what it means to be in your head  
5. Explain what it means to be coachable  
6. Explain what it feels like to peak too early  
7. Explain what it means to have good taste  
8. Explain what it means to be a people pleaser  
9. Explain what it means to have a poker face  
10. Explain what it means to be ahead of your time  
11. Explain what it means to have a green thumb  
12. Explain what it means to be a social butterfly  
13. Explain what it means to be low maintenance  
14. Explain what it feels like to be caught off guard  
15. Explain what it feels like when something is overrated  
16. Explain what it means to be a homebody  
17. Explain what it means to be ahead of the curve  
18. Explain what it means to have a chip on your shoulder

**Exercise 3: No Jargon Allowed**

Every insider term or industry phrase is banned. Find plain language replacements in real time.

1. Explain what consulting is. 

**Exercise 4: One Point Only**

Pick one single idea before you start. Build everything around it and never leave it.

1. What makes someone a great listener?  
2. What makes a sports rivalry genuinely exciting?  
3. What makes a flight feel bearable?

	

**Exercise 5: The Word Budget**

You have a strict word limit. Say everything you need to say within it. Not a word more.

1. Tell me about your day. 75 words maximum  
2. What makes someone fun to travel with? 75 words maximum.  
3. What makes a job worth turning down more money for? 75 words maximum.

	

# Structure Prompts

**STRUCTURE — Prompt Bank**

**Exercise 1: The 3 Point Rule**

Organize your entire response into exactly three distinct points. No more, no less.

	

**Exercise 2: The Story Arc**

Structure any response as a setup, conflict, and resolution with a clear beginning, tension, and payoff.

1. Tell me about a time you got lost somewhere and what happened.

**Exercise 3: Bottom Line First**

Your conclusion goes in the first sentence. No warmup, no buildup, no context setting before the point.

1. Is having a dog better than having a cat?  
2. Should people move abroad at least once in their life?	

**Exercise 4: Monroe’s Motivated Sequence**

Move the listener from awareness to action using five steps — Attention, Need, Solution, Visualization, Action.

1. Convince someone to learn how to cook.

	

# Conciseness Prompts

**CONCISENESS — Prompt Bank**

**Exercise 1: The 30 Second Rule**

Make your complete point in 30 seconds or less. No warmup, no repetition, no over-explanation.

		

**Exercise 2: Kill the Filler**

Zero filler words. The moment um, uh, like, you know, basically, or literally comes out the rep starts over.

		

	

**Exercise 3: One Idea Per Response**

One idea only. If a second idea starts to creep in it gets cut.

	

**Exercise 4: The Hard Stop**

The moment your point is fully made you stop. No summary, no wrap-up, no restatement.

	

# Thinking Quality Prompts

**THINKING QUALITY — Prompt Bank**

**Exercise 1: The Claim and Proof**

Every claim you make must be proven in the same breath with evidence, a reason, or a specific example.

1. Why do people who grow up playing team sports tend to be better employees?

**Exercise 2: The Steel Man**

Before giving your own position argue the strongest possible version of the opposing view first.

		

**Exercise 3: The So What Test**

Every point you make must answer the question so what before you move on.

	

**Exercise 4: The Perspective Shift**

Argue the prompt from a perspective that is not your own — a different role, age group, industry, or worldview.

	

# Pacing Prompts

PACING — Prompt Bank

Exercise 1: The Metronome Speak at a deliberate controlled rate from the first word to the last. No rushing, no dragging.

Exercise 2: The Strategic Pause Pause before your most important point to build anticipation. Pause after it to let it land.

Exercise 3: Silence Over Filler Every time you would normally reach for a filler word replace it with silence instead.

Exercise 4: The Speed Shift Speak at a normal rate but slow down significantly on the single most important sentence.

Exercise 5: The Rhythm Check Vary your pace intentionally throughout. Speed up to build momentum, slow down to land importance.

# Tone Prompts

**TONE — Prompt Bank**

**Exercise 1: The Monotone Breaker** 

Every sentence must sound different from the one before it. No two consecutive sentences at the same pitch and volume.

**Exercise 2: The Volume Dial Intentionally** 

increase volume on the most important word in each sentence.

**Exercise 3: The Warmth Switch Deliver** 

every sentence as if you genuinely care about the person listening.

**Exercise 4: The Authority Voice Every** 

statement delivered with full conviction. No trailing off, no softening, no apologetic tone.

**Exercise 5: The Downward Landing Every** 

statement must end with a downward inflection. No upspeak, no trailing off.

**Exercise 6: The Emotional Dial Match** 

the emotional weight of your content with the emotional quality of your voice.

**Exercise 7: The Resonance Rep Speak** 

from your chest not your throat. Full vocal resonance from the first word to the last.

# Section 6: The Lab

# **6\. The Lab**

## **6.1 Purpose**

The Lab is Cognify's communication application training environment.

While Daily Workout develops communication fundamentals, The Lab develops communication applications.

The purpose of The Lab is to help users repeatedly apply communication fundamentals within common real-world communication environments until effective communication behaviors become automatic.

The Lab focuses on:

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

Unlike Daily Workout, which trains communication fundamentals directly, The Lab trains the application of those fundamentals.

Users are not learning communication theory.

Users are practicing communication performance.

Unlike Daily Workout, The Lab is not responsible for deciding what communication application users should practice. Users intentionally choose the application they want to improve (e.g., Storytelling or Presenting). Once selected, Cognify personalizes the experience within that application by choosing the most valuable hidden Application Skill, exercise, and prompt based on the user’s Communication Profile and previous performance within that application.

The Lab is organized into Applications.

An Application represents a real-world communication context, such as Storytelling, Presenting, Interviewing, Teaching, or Persuasion.

Each Application contains:

* Hidden Behaviors  
* Exercise Frameworks  
* Exercises  
* Prompts

This hierarchy allows Cognify to teach communication within realistic contexts while maintaining consistent training principles across every Application.

---

## **6.2 Communication Applications**

### **Storytelling**

The ability to communicate experiences, ideas, and messages through compelling narratives.

### **Presenting**

The ability to organize and deliver information to an audience.

### **Teaching**

The ability to help another person understand something they did not understand before.

### **Interviewing**

The ability to answer questions in a clear, compelling, and evidence-based manner.

### **Persuasion**

The ability to influence beliefs, decisions, and actions through communication.

---

## **6.3 Application Selection**

Users begin by selecting the communication application they want to practice.

Examples:

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

Once an application is selected, Cognify determines:

* Application Skills  
* Exercises  
* Difficulty  
* Coaching  
* Personalization

Users choose prompts.

Cognify chooses everything else.

This follows one of the core product principles:

Cognify Decides, User Practices.

---

## **6.4 Session Configuration**

Before beginning a session, users choose how many exercises they want to complete.

Examples:

* 3 Exercises  
* 5 Exercises  
* 10 Exercises

The default recommendation is 3 exercises.

This provides enough repetition to create meaningful improvement while remaining short enough to encourage consistent usage.

Longer sessions provide additional deliberate practice opportunities but are not required.

### **Session Flow**

Exercise 1

* Coach's Insight  
* Prompt Selection  
* First Rep  
* Coach Feedback  
* Retry  
* Improvement Review

↓

Exercise 2

↓

Exercise 3

↓

Session Complete

Each exercise follows the Cognify Training System defined in Section 4\.

---

## **6.5 Application Framework**

Each Application is supported by an underlying framework that powers exercise generation, coaching, scoring, personalization, adaptive practice, and mastery development.

The framework follows a four-layer hierarchy:

Application

↓

Application Skill

↓

Exercise

↓

Prompt

### **Application**

The highest-level training category.

Examples:

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

### **Application Skills**

Each Application contains a set of underlying Application Skills representing the specific abilities required to perform effectively within that communication environment.

Application Skills are used to:

* Generate exercises  
* Personalize training  
* Generate coaching  
* Drive adaptive practice  
* Track mastery

Application Skills may be surfaced through progression systems but primarily exist to power the training engine.

### **Exercises**

Exercises are specific training activities designed to develop one or more Application Skills.

Examples:

Storytelling

* Personal Story  
* Failure Story  
* Success Story  
* Turning Point Story

Interviewing

* Behavioral Question  
* Leadership Question  
* Failure Question  
* Problem Solving Question

Persuasion

* Recommendation  
* Objection Handling  
* Debate  
* Negotiation

### **Prompts**

Prompts are the individual scenarios, questions, or topics users respond to during an exercise.

Users choose prompts.

For each exercise, Cognify generates six prompt options that target the same Application Skill and exercise objective.

Users may:

* Select a prompt  
* Refresh prompts  
* Continue refreshing until they find a prompt they want to answer

The exercise objective remains constant.

Only the topic changes.

### **Design Decisions**

* Users choose prompts.  
* Cognify chooses Application Skills.  
* Cognify chooses exercises.  
* Cognify chooses difficulty.  
* Six prompts are displayed at a time.  
* Prompt refreshes preserve the same training objective.

---

## **6.6 Adaptive Practice**

New users initially receive a balanced mix of exercises across the selected Application.

The objective is to establish a performance baseline.

As performance data accumulates, Cognify begins personalizing practice.

Application Skills requiring more development appear more frequently.

Stronger Application Skills continue appearing periodically to reinforce strengths and prevent regression.

The objective is not weakness-only training.

The objective is balanced long-term mastery.

### **Adaptive Practice Rules**

* Weak Application Skills receive increased training volume.  
* Strong Application Skills continue receiving maintenance reps.  
* Recently completed exercises should be deprioritized.  
* Exercise difficulty should adapt over time.  
* Sessions should remain varied and engaging.

---

## **6.7 Mastery Development**

The purpose of The Lab is mastery.

Unlike Daily Workout, which focuses on communication fundamentals, The Lab focuses on becoming highly effective within specific communication environments.

### **Application Scores**

Each Application maintains its own score.

Examples:

* Storytelling: 84  
* Presenting: 77  
* Teaching: 89  
* Interviewing: 73  
* Persuasion: 81

These scores represent overall proficiency within each Application.

### **Application Progression**

As users practice, Application Scores should improve over time.

Progression should reflect:

* Exercise performance  
* Coaching implementation  
* Consistency  
* Improvement trends

### **Application Mastery**

Mastery represents long-term development within an Application.

The goal is not achieving a perfect score.

The goal is becoming consistently effective across the Application's underlying skills and exercise types.

---

## **6.8 Session Complete**

After completing all selected exercises, users reach the Session Complete screen.

The purpose of this screen is to summarize performance, reinforce improvement, and provide visibility into development.

### **Session Complete Structure**

Application Score

↓

Improvement During Session

↓

Most Improved Application Skill

↓

Core Skill Breakdown

↓

Coach Recommendation

↓

Reps Earned

### **Coach Recommendation**

Coach Recommendation identifies the next highest-value development opportunity.

Recommendations may include:

* Continue practicing the current Application  
* Focus on a specific Application Skill  
* Train a related Application  
* Return to Daily Workout to strengthen a supporting Core Skill

---

## **6.9 Success Criteria**

The Lab is successful if users:

* Improve Application Scores over time  
* Develop mastery within communication applications  
* Apply communication fundamentals more effectively  
* Build confidence in real-world communication situations

The primary outcome of The Lab should be measurable improvement within the communication environments users encounter most often.

# 🚂 The Lab Engine V1

**THE LAB PROMPT GENERATION ENGINE V1:**

Now it is your turn to perform as Cognify’s The Lab Prompt Architect.

Your task is to generate The Lab speaking prompt packs that help users apply communication fundamentals inside realistic communication applications.

Cognify is a communication gym. Daily Workout trains Core Skills directly: Clarity, Structure, Conciseness, Thinking Quality, Pacing, and Tone. The Lab is different. The Lab trains users to apply those fundamentals inside practical communication environments such as Storytelling, Presenting, Teaching, Interviewing, and Persuasion.

The goal is not to teach theory passively. The goal is to create deliberate practice: focused speaking reps, immediate feedback, retry, and measurable improvement in real-world communication situations.

For each The Lab exercise, generate four user-facing prompt options that all train the same Application, the same Application Skill, and the same underlying communication behavior, while varying the topic so the user can choose which one they want to answer.

The surface topic may change.  
The training objective must stay the same.

Each prompt must be:

\* Spoken-response appropriate  
\* Clear in audience, setting, and stakes  
\* Realistic enough to transfer to real-world communication  
\* Focused on one primary Application Skill  
\* Connected to one or more Core Skills  
\* Challenging but not overwhelming  
\* Suitable for a 60–120 second spoken response  
\* Designed for retry after coaching  
\* Specific enough to evaluate  
\* Simple enough for the user to understand immediately

The Lab applications are:

1\. Storytelling  
   The ability to communicate experiences, ideas, and messages through compelling narratives.  
2\. Presenting  
   The ability to organize and deliver information to an audience.  
3\. Teaching  
   The ability to help another person understand something they did not understand before.  
4\. Interviewing  
   The ability to answer questions in a clear, compelling, evidence-based manner.  
5\. Persuasion  
   The ability to influence beliefs, decisions, or actions through communication.

For each generated prompt pack, identify:

\* Application  
\* Application Skill  
\* Exercise Type  
\* Primary Training Objective  
\* Primary Core Skill  
\* Secondary Core Skills  
\* Recommended Response Structure  
\* Difficulty Level  
\* Coach’s Insight  
\* Four Prompt Options  
\* Hidden Training Behaviors  
\* Common Failure Modes  
\* Scoring Emphasis  
\* Retry Objective

Use communication theory implicitly, not academically. The user should not see references to Aristotle, Grice, Cognitive Load Theory, Communication Accommodation Theory, Minto, Ericsson, TED, the Heath brothers, or other formal frameworks unless explicitly requested.

Instead, translate theory into practical speaking challenges.

For example:

\* Do not say “Use Grice’s Maxim of Quantity.”  
  Say: “Give enough detail to be useful, but stop before the listener has to sort through extra information.”

\* Do not say “Apply Communication Accommodation Theory.”  
  Say: “Adjust your language and tone for this specific listener.”

\* Do not say “Use the Pyramid Principle.”  
  Say: “Lead with the answer, then support it with the most important reasons.”

\* Do not say “Reduce extraneous cognitive load.”  
  Say: “Make the idea easy for the listener to hold onto.”

Each prompt pack should be built around the following hierarchy:

Application  
↓  
Application Skill  
↓  
Exercise Type  
↓  
Prompt Options

Application Skills should be specific abilities required for strong performance within an application.

Examples:

Storytelling Application Skills may include:

\* Establishing stakes  
\* Creating narrative tension  
\* Using concrete detail  
\* Showing change over time  
\* Delivering a clear takeaway  
\* Balancing context and action  
\* Making the listener care  
\* Connecting a personal story to a broader point

Presenting Application Skills may include:

\* Framing the main message  
\* Opening with a clear through-line  
\* Organizing ideas into memorable chunks  
\* Signposting transitions  
\* Explaining data or evidence  
\* Adapting to audience priorities  
\* Closing with a clear implication  
\* Making abstract information concrete

Teaching Application Skills may include:

\* Simplifying a complex idea  
\* Explaining with analogy  
\* Sequencing from known to unknown  
\* Checking for likely confusion  
\* Defining terms clearly  
\* Using examples and non-examples  
\* Teaching for application, not memorization  
\* Adjusting explanation depth to the learner

Interviewing Application Skills may include:

\* Answering behavioral questions with evidence  
\* Structuring a concise personal example  
\* Demonstrating self-awareness  
\* Explaining motivation  
\* Handling weakness or failure questions  
\* Connecting experience to future fit  
\* Showing judgment under pressure  
\* Making claims credible through specifics

Persuasion Application Skills may include:

\* Framing a recommendation  
\* Handling objections  
\* Appealing to audience priorities  
\* Building credibility  
\* Using evidence selectively  
\* Creating urgency without exaggeration  
\* Balancing warmth and conviction  
\* Asking for a clear next step

Exercise Types should be repeatable training formats.

Examples:

Storytelling Exercise Types:

\* Personal Story  
\* Failure Story  
\* Success Story  
\* Turning Point Story  
\* Origin Story  
\* Lesson Learned Story  
\* Conflict Story  
\* Values Story

Presenting Exercise Types:

\* Executive Update  
\* Project Briefing  
\* Problem Overview  
\* Data Explanation  
\* Recommendation Presentation  
\* Status Update  
\* Opening Statement  
\* Closing Summary

Teaching Exercise Types:

\* Explain Like I’m New  
\* Teach with an Analogy  
\* Break Down a Process  
\* Correct a Misconception  
\* Explain a Tradeoff  
\* Teach a Concept Through an Example  
\* Simplify a Technical Idea  
\* Explain Why Something Matters

Interviewing Exercise Types:

\* Behavioral Question  
\* Leadership Question  
\* Failure Question  
\* Conflict Question  
\* Motivation Question  
\* Strength Question  
\* Weakness Question  
\* Problem-Solving Question

Persuasion Exercise Types:

\* Recommendation  
\* Objection Handling  
\* Debate  
\* Negotiation  
\* Change Someone’s Mind  
\* Make the Case  
\* Sell an Idea  
\* Ask for Buy-In

Each prompt pack must include a Coach’s Insight before the prompts.

The Coach’s Insight should be:

\* Specific  
\* Actionable  
\* Memorable  
\* Focused on one behavior  
\* Immediately applicable  
\* No more than 1–2 sentences  
\* Written like a communication coach, not like an academic lecturer

Examples of strong Coach’s Insights:

Storytelling:  
A story becomes interesting when the listener understands what could be lost, gained, or changed. Do not just describe what happened; show why it mattered.

Presenting:  
A strong presentation does not make the audience collect your points. It gives them one clear idea to carry, then organizes everything around it.

Teaching:  
A good explanation does not prove how much you know. It removes the listener’s next point of confusion.

Interviewing:  
A strong interview answer does not claim a trait. It proves the trait with a specific moment.

Persuasion:  
Do not make the listener assemble your argument. Give them the decision first, then the reasons they need to believe it.

When generating prompt options, follow these rules:

1\. All four prompts must train the same underlying behavior.

Bad:  
One prompt trains storytelling, another trains persuasion, another trains teaching.

Good:  
All four prompts train “establishing stakes in a personal story,” but each uses a different topic.

2\. Vary the surface topic, not the exercise objective.

Bad:  
Prompt 1 asks for a failure story.  
Prompt 2 asks for a recommendation.  
Prompt 3 asks for a teaching explanation.

Good:  
All four ask for a failure story where the user must show what was at stake and what changed.

3\. Include audience, setting, and stakes.

Bad:  
“Tell a story about a challenge.”

Good:  
“You are in a job interview. Tell a 90-second story about a challenge you faced on a team, making clear what was at stake and what changed because of your actions.”

4\. Make the expected response structure clear or strongly implied.

For behavioral interview prompts, imply STAR or a similar story arc.  
For recommendation prompts, imply bottom-line-first reasoning.  
For teaching prompts, imply definition, analogy, example, and application.  
For presenting prompts, imply a main message, supporting points, and implication.  
For persuasion prompts, imply audience priority, reason, evidence, and ask.

5\. Do not overload the user.

Each prompt should create one main communication challenge. Avoid stacking too many constraints, audiences, emotional dynamics, and content requirements into a single prompt unless the difficulty level is advanced.

6\. Preserve authenticity.

The user should not be trained to sound polished but empty. Prompts should reward truthful, specific, grounded communication over vague performance.

7\. Support transfer.

Use varied real-world contexts across professional, academic, leadership, social, and personal domains. The user should not only become good at one narrow type of prompt.

8\. Make prompts retryable.

A user should be able to answer once, receive coaching, and immediately try again with a clearer target. The prompt should not depend on surprise, trivia, or one-time cleverness.

Output format:

Application:  
\[Name of application\]

Application Skill:  
\[Specific skill being trained\]

Exercise Type:  
\[Repeatable exercise format\]

Primary Training Objective:  
\[One sentence explaining the communication behavior this exercise trains\]

Primary Core Skill:  
\[Clarity, Structure, Conciseness, Thinking Quality, Pacing, or Tone\]

Secondary Core Skills:  
\[List 1–3 supporting Core Skills\]

Recommended Response Structure:  
\[Name or plain-language description of the best structure; user-facing version should be practical, not academic\]

Difficulty Level:  
\[Beginner, Intermediate, Advanced, or Expert\]

Coach’s Insight:  
\[1–2 sentence coaching cue\]

Prompt Options:

1\. \[Prompt option\]  
2\. \[Prompt option\]  
3\. \[Prompt option\]  
4\. \[Prompt option\]

Hidden Training Behaviors:

\* \[Behavior 1\]  
\* \[Behavior 2\]  
\* \[Behavior 3\]  
\* \[Behavior 4\]

Common Failure Modes:

\* \[Failure mode 1\]  
\* \[Failure mode 2\]  
\* \[Failure mode 3\]

Scoring Emphasis:

\* \[What the evaluator should primarily look for\]  
\* \[What strong execution sounds like\]  
\* \[What weak execution sounds like\]

Retry Objective:  
\[One sentence describing what the user should improve on the second attempt\]

Important style rules:

\* Write prompts in plain, user-facing language.  
\* Do not sound academic.  
\* Do not mention hidden theory in user-facing prompts.  
\* Do not generate prompts that are merely interesting; generate prompts that train.  
\* Do not generate prompts that are too vague to evaluate.  
\* Do not generate prompts that depend on specialized knowledge unless the exercise explicitly requires expert communication.  
\* Do not make all prompts corporate. The Lab should include professional, academic, leadership, creative, interpersonal, and everyday communication contexts.  
\* Do not ask the user to roleplay unrealistic scenarios unless the application calls for simulation.  
\* Do not make the user pretend to hold beliefs, credentials, or experiences they may not have.  
\* When possible, phrase prompts so users can draw from their real experience.  
\* If a prompt asks the user to persuade, argue, teach, or recommend, make the audience’s priorities clear.  
\* If a prompt asks the user to tell a story, make the moment of change, stakes, or lesson clear.  
\* If a prompt asks the user to present, make the audience and purpose clear.  
\* If a prompt asks the user to teach, make the learner’s starting point clear.  
\* If a prompt asks the user to interview, make the role, setting, and evaluation criteria clear.

The final result should feel like a communication gym rep:

Focused enough to train.  
Realistic enough to transfer.  
Flexible enough for user choice.  
Structured enough to score.  
Specific enough to retry.

# Example Output (Storytelling)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Application:*  
*Storytelling*

*Application Skill:*  
*Establishing Stakes*

*Exercise Type:*  
*Personal Story*

*Primary Training Objective:*  
*Train the user to make a personal story compelling by clearly showing what could be lost, gained, or changed.*

*Primary Core Skill:*  
*Thinking Quality*

*Secondary Core Skills:*  
*Structure, Clarity, Tone*

*Recommended Response Structure:*  
*Set the scene briefly, name what was at stake, describe the key moment, explain what changed, and end with the takeaway.*

*Difficulty Level:*  
*Intermediate*

**Coach’s Insight:**  
**A story becomes interesting when the listener understands why the moment mattered. Do not just describe what happened; show what could have changed if things went differently.**

**Prompt Options:**

1. **You are in a job interview. Tell a 90-second story about a time you had to step up when something important was at risk, making clear what was at stake and what changed because of your actions.**  
2. **You are speaking to a group of younger students. Tell a short story about a moment when you realized you needed to take something more seriously, making clear why the moment mattered.**  
3. **You are introducing yourself to a new team. Tell a story about a challenge that shaped the way you work, making clear what was difficult, what was at risk, and what you learned.**  
4. **You are giving a short reflection at a leadership retreat. Tell a story about a time you almost missed an important opportunity, making clear what could have been lost and what changed afterward.**

*Hidden Training Behaviors:*

* *Establish the stakes early*  
* *Avoid overloading the listener with background*  
* *Show a clear before-and-after change*  
* *End with a takeaway that connects the story to a broader point*

*Common Failure Modes:*

* *Spending too long on setup before anything matters*  
* *Describing events without explaining why they were important*  
* *Ending with a vague lesson that feels disconnected from the story*

*Scoring Emphasis:*

* *The evaluator should primarily look for whether the listener understands why the story mattered.*  
* *Strong execution sounds focused, specific, and emotionally grounded.*  
* *Weak execution sounds like a sequence of events without tension, consequence, or change.*

*Hypothetical Retry Objective:*  
*On the second attempt, make the stakes clear within the first 20 seconds and sharpen the final takeaway.*

# Example Output (Presenting)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Application:*  
*Presenting*

*Application Skill:*  
*Framing the Main Message*

*Exercise Type:*  
*Executive Update*

*Primary Training Objective:*  
*Train the user to open a short presentation with one clear message that organizes the rest of the response.*

*Primary Core Skill:*  
*Structure*

*Secondary Core Skills:*  
*Conciseness, Clarity, Thinking Quality*

*Recommended Response Structure:*  
*Lead with the main message, give two or three supporting points, explain the implication, and close with what the audience should remember or do next.*

*Difficulty Level:*  
*Intermediate*

**Coach’s Insight:**  
**A strong presentation does not make the audience collect your points. It gives them one clear idea to carry, then organizes everything around it.**

**Prompt Options:**

1. **You are giving a 90-second update to a busy manager about a project that is slightly behind schedule. Explain the main message, the reason for the delay, and what should happen next.**  
2. **You are presenting to a student organization about why attendance has dropped at recent meetings. Give the group one clear takeaway, then organize the most important reasons around it.**  
3. **You are briefing a small research team on early results from a project. Present the main finding, explain what supports it, and close with what the team should pay attention to next.**  
4. **You are updating a volunteer group after a recent event did not go as planned. Give a clear summary of what happened, what it means, and what the group should improve next time.**

*Hidden Training Behaviors:*

* *State the main message before details*  
* *Group supporting points clearly*  
* *Use transitions that help the listener follow*  
* *Close with a clear implication or next step*

*Common Failure Modes:*

* *Starting with background instead of the main point*  
* *Listing details without a clear organizing idea*  
* *Ending abruptly without saying what the information means*

*Scoring Emphasis:*

* *The evaluator should primarily look for whether the response has one clear through-line.*  
* *Strong execution sounds organized, purposeful, and easy to follow.*  
* *Weak execution sounds like a scattered update where the audience has to infer the main point.*

*Hypothetical Retry Objective:*  
*On the second attempt, lead with a sharper one-sentence main message before adding any supporting detail.*

# Example Output (Teachng)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Application:*  
*Teaching*

*Application Skill:*  
*Simplifying a Complex Idea*

*Exercise Type:*  
*Explain Like I’m New*

*Primary Training Objective:*  
*Train the user to explain an unfamiliar idea by starting with the listener’s current understanding and building step by step.*

*Primary Core Skill:*  
*Clarity*

*Secondary Core Skills:*  
*Structure, Tone, Conciseness*

*Recommended Response Structure:*  
*Start with a simple definition, use a concrete analogy or example, explain why it matters, and avoid unnecessary technical detail.*

*Difficulty Level:*  
*Beginner-Intermediate*

**Coach’s Insight:**  
**A good explanation does not prove how much you know. It removes the listener’s next point of confusion.**

**Prompt Options:**

1. **You are explaining compound interest to a friend who has just opened their first savings account. Teach the idea in 90 seconds using simple language and one concrete example.**  
2. **You are explaining burnout to a younger student who thinks it just means being tired. Help them understand the concept clearly without sounding dramatic or clinical.**  
3. **You are explaining opportunity cost to a friend who says a free event has no cost. Use a simple example that helps them understand what they give up when they choose one option over another.**  
4. **You are explaining what a research hypothesis is to someone who has never done a science project. Make the idea easy to understand and show why it matters.**

*Hidden Training Behaviors:*

* *Define the idea in plain language*  
* *Use one concrete example or analogy*  
* *Sequence from familiar to unfamiliar*  
* *Avoid jargon unless it is immediately explained*

*Common Failure Modes:*

* *Using technical language too early*  
* *Giving too many examples instead of one clear one*  
* *Explaining around the idea without defining it directly*

*Scoring Emphasis:*

* *The evaluator should primarily look for whether a beginner could understand and use the idea afterward.*  
* *Strong execution sounds simple, patient, and precise.*  
* *Weak execution sounds knowledgeable but hard to follow.*

*Hypothetical Retry Objective:*  
*On the second attempt, simplify the opening definition and use one clearer example.*

# Example Output (Interviewing)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Application:*  
*Interviewing*

*Application Skill:*  
*Making Claims Credible Through Specifics*

*Exercise Type:*  
*Behavioral Question*

*Primary Training Objective:*  
*Train the user to answer an interview question by proving a personal quality through a specific example rather than simply claiming it.*

*Primary Core Skill:*  
*Thinking Quality*

*Secondary Core Skills:*  
*Structure, Conciseness, Tone*

*Recommended Response Structure:*  
*Briefly set context, explain your role, describe the specific action you took, name the result, and connect it to the quality being evaluated.*

*Difficulty Level:*  
*Intermediate*

**Coach’s Insight:**  
**A strong interview answer does not claim a trait. It proves the trait with a specific moment.**

**Prompt Options:**

1. **You are in an interview for a selective internship. Answer: “Tell me about a time you showed leadership when you did not have an official title.”**  
2. **You are interviewing for a research position. Answer: “Tell me about a time you had to be detail-oriented under pressure.”**  
3. **You are interviewing for a service or volunteer role. Answer: “Tell me about a time you worked with someone who saw a problem differently than you did.”**  
4. **You are interviewing for a competitive academic program. Answer: “Tell me about a time you responded well to criticism or feedback.”**

*Hidden Training Behaviors:*

* *Use a specific story rather than a general claim*  
* *Make your role in the situation clear*  
* *Emphasize concrete actions*  
* *Tie the example back to the quality being evaluated*

*Common Failure Modes:*

* *Saying “I’m a leader” without proving it*  
* *Spending too much time on context and not enough on action*  
* *Ending without explaining what the example shows about the speaker*

*Scoring Emphasis:*

* *The evaluator should primarily look for whether the answer makes the claimed quality believable.*  
* *Strong execution sounds specific, mature, and evidence-based.*  
* *Weak execution sounds polished but generic.*

*Hypothetical Retry Objective:*  
*On the second attempt, replace any broad self-description with a concrete action or result.*

# Example Output (Persuasion)

*Italics: Under the hood*  
**Bold: User interface**

**\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

*Application:*  
*Persuasion*

*Application Skill:*  
*Framing a Recommendation*

*Exercise Type:*  
*Recommendation*

*Primary Training Objective:*  
*Train the user to make a clear recommendation by leading with the desired decision, supporting it with audience-relevant reasons, and ending with a specific next step.*

*Primary Core Skill:*  
*Structure*

*Secondary Core Skills:*  
*Thinking Quality, Conciseness, Tone*

*Recommended Response Structure:*  
*Lead with the recommendation, give two audience-relevant reasons, address one likely concern if needed, and close with a clear ask.*

*Difficulty Level:*  
*Intermediate*

**Coach’s Insight:**  
**Do not make the listener assemble your argument. Give them the decision first, then the reasons they need to believe it.**

**Prompt Options:**

1. **You are speaking to a busy team leader. Recommend that your group replace a weekly meeting with a shorter written update, making clear why this would save time without reducing accountability.**  
2. **You are speaking to a student organization’s executive board. Recommend changing the format of an event that has become predictable, making clear why the change would improve attendance.**  
3. **You are speaking to a skeptical friend who wants to keep procrastinating on an important task. Recommend one practical first step they should take today, making clear why it is manageable.**  
4. **You are speaking to a project partner. Recommend narrowing the scope of a presentation so it becomes clearer and more persuasive, making clear what should be cut and why.**

*Hidden Training Behaviors:*

* *State the recommendation early*  
* *Choose reasons that matter to the listener*  
* *Avoid over-explaining or sounding defensive*  
* *End with a concrete next step*

*Common Failure Modes:*

* *Building up to the recommendation too slowly*  
* *Giving reasons that matter to the speaker but not the listener*  
* *Ending with a vague suggestion instead of a clear ask*

*Scoring Emphasis:*

* *The evaluator should primarily look for whether the listener knows exactly what is being recommended and why.*  
* *Strong execution sounds direct, practical, and audience-aware.*  
* *Weak execution sounds hesitant, over-explained, or unclear about the desired action.*

*Hypothetical Retry Objective:*  
*On the second attempt, state the recommendation in the first sentence and make the final ask more specific.*

# Application Skills Workout Bank

# Storytelling Workouts

Tell “the saddest six-word story” with compelling pauses and emotive expression.  
	(*Baby shoes, for sale, never worn.*)

# Presenting Workouts

# Teaching Workouts

Read a 5-7 sentence paragraph explaining a topic, then teach it in 1-2 sentences.

# Interviewing Workouts

Answer a standard interview question about yourself, then finish your answer with a compelling question for the interviewer.

# Persuasion Workouts

Read this neutral factual statement, then present it to a stakeholder with warmth and purpose.

# Application Skills Prompt Bank

# Storytelling Prompts

# Presenting Prompts

# Teaching Prompts

# Interviewing Prompts

# Persuasion Prompts

# Section 7: Build a Rep

# **7\. Build a Rep**

## **7.1 Purpose**

Build a Rep is Cognify’s communication readiness environment.

While Daily Workout develops communication fundamentals and The Lab develops communication applications, Build a Rep helps users prepare for a specific upcoming communication event.

Examples include:

* Job Interviews  
* Presentations  
* Investor Pitches  
* Wedding Toasts  
* Product Demos  
* Team Meetings  
* Meeting Updates  
* Speeches  
* Prepared Remarks

The objective is not long-term communication improvement.

The objective is helping users perform as effectively as possible during an important real-world communication event.

Build a Rep should help users understand what they are most likely to face, practice those moments, receive personalized coaching, and enter the real event with greater confidence.

Unlike Daily Workout, Build a Rep does not determine which communication event users should prepare for. Users choose the real-world event they want to practice. Cognify then personalizes the preparation experience by generating the most relevant preparation plan, critical moments, coaching, and practice experience for that specific event.

Build a Rep allows users to prepare for a specific real-world communication event.

Users provide context about an upcoming conversation, presentation, interview, or other communication scenario. Cognify then generates realistic practice experiences that simulate the event, provide targeted coaching, and measure readiness before the real interaction takes place.

Unlike Daily Workout and The Lab, Build a Rep is focused on preparation rather than long-term skill development.

---

## **7.2 Readiness vs. Mastery**

Build a Rep serves a different purpose than the rest of Cognify.

Daily Workout develops communication fundamentals.

The Lab develops communication applications.

Build a Rep develops readiness.

Daily Workout and The Lab are designed to improve communication ability over time through deliberate practice.

Build a Rep is designed to prepare users for a specific communication event that is approaching.

Rather than asking:

*“How can I become a better communicator?”*

Build a Rep answers:

*“How can I perform my best in this specific situation?”*

Because of this, Build a Rep prioritizes:

* Event-specific preparation  
* Personalized coaching  
* Confidence before the event  
* Practicing the moments most likely to determine success

Users should leave Build a Rep feeling prepared for the communication event immediately in front of them.

---

## **7.3 Creating a Build a Rep**

Users begin by describing what they are preparing for.

Examples:

* SDR Interview at Salesforce  
* Investor Pitch  
* Team Presentation  
* Wedding Toast  
* Product Demo  
* Quarterly Business Review

The setup experience should feel simple and conversational.

Users should not have to build their own training plan.

Instead, they simply describe the event they are preparing for and Cognify handles the rest.

The goal is to get users practicing as quickly as possible.

---

## **7.4 Context Uploads**

Users may optionally provide additional context to personalize their preparation.

Examples include:

* Resume  
* Job Description  
* Presentation Deck  
* Meeting Agenda  
* Company Information  
* Notes  
* Talking Points  
* Background Documents

Context is never required.

Users should always be able to continue without uploading anything.

However, the more context provided, the more personalized the preparation experience becomes.

---

## **7.5 Context-Aware Personalization**

After the user provides their event description and any additional context, Cognify personalizes the entire preparation experience.

Context should influence:

* The Preparation Plan  
* Critical Moment generation  
* Coaching  
* Recommendations  
* Readiness Review

If little or no context is provided, Cognify should generate the most likely preparation plan based on the communication event.

For example, if a user simply enters:

**“I’m preparing for an SDR interview.”**

Cognify should automatically generate the questions and communication moments the user is most likely to encounter.

As additional context is provided, the preparation experience should become increasingly specific.

For example, uploading a resume and job description should produce a more personalized preparation plan than simply entering “SDR Interview.”

The objective is to eliminate setup friction while still allowing Build a Rep to become highly personalized when additional information is available.

---

## **7.6 Preparation Modes**

After entering the communication event and any supporting context, users choose how they want to prepare.

### **Guided Practice**

Guided Practice allows users to practice one Critical Moment at a time.

This mode is best when users want to improve individual parts of a communication event before putting everything together.

Examples include:

* Perfecting a “Tell Me About Yourself” answer  
* Practicing one difficult presentation slide  
* Improving the recommendation section of a presentation  
* Working through individual interview questions  
* Receiving focused coaching on specific communication moments

Users receive coaching after every rep and can immediately implement feedback through retries before moving on.

---

### **Full Simulation**

Full Simulation allows users to practice the entire communication event from beginning to end.

This mode is best when users want to evaluate their overall readiness under realistic conditions.

Examples include:

* Delivering an entire presentation  
* Giving a complete wedding toast  
* Running through an investor pitch  
* Presenting a product demo  
* Delivering a keynote speech

During Full Simulation, Cognify does not interrupt the user with coaching or retries.

Feedback is delivered only after the simulation has been completed.

Cognify may recommend one preparation mode based on the communication event, but users are free to choose whichever mode best matches how they want to prepare.

## **7.7 Guided Practice**

Guided Practice is designed to help users improve one Critical Moment at a time.

Rather than practicing an entire communication event, users focus on the individual moments that are most likely to determine success.

This allows users to isolate weak areas, receive targeted coaching, implement feedback immediately, and build confidence before moving on.

---

### **Preparation Plan**

After Guided Practice is selected, Cognify generates a Preparation Plan.

The Preparation Plan is a breakdown of the most important Critical Moments the user is likely to encounter during their communication event.

Examples:

### **SDR Interview**

* Tell Me About Yourself  
* Why Sales?  
* Why This Company?  
* Why This Role?  
* Rejection Example  
* Questions For The Interviewer

### **Presentation**

* Opening  
* Current State  
* Problem  
* Recommendation  
* Next Steps  
* Q\&A Preparation

The Preparation Plan serves as the foundation of Guided Practice.

Rather than deciding what to practice themselves, users are immediately given a structured training plan.

---

### **Critical Moment Generation**

When little or no context is provided, Cognify automatically generates the Critical Moments most likely to determine success for that communication event.

The objective is to eliminate setup friction while still providing a personalized preparation experience.

As additional context is provided, the Preparation Plan should become increasingly customized.

For example:

A user who enters:

**“I’m preparing for an SDR interview.”**

should receive a strong generic interview preparation plan.

A user who uploads their resume and the Salesforce job description should receive a significantly more personalized Preparation Plan tailored to that interview.

Whenever possible, Cognify should determine what users are most likely to encounter so they spend less time planning and more time practicing.

---

### **Editing the Preparation Plan**

The Preparation Plan is fully editable.

Before beginning Guided Practice, users can:

* Add Critical Moments  
* Remove Critical Moments  
* Rename Critical Moments  
* Reorder Critical Moments

Cognify generates the initial preparation plan.

The user has complete control over customizing it to fit their situation.

---

### **Guided Practice Flow**

Users choose any Critical Moment from their Preparation Plan.

Each Critical Moment follows the same training loop.

Coach's Insight

↓

Rep

↓

Feedback

↓

Retry

or

Continue to Next Critical Moment

or

Return to Preparation Plan

↓

Improvement Review

↓

Retry Again

or

Continue to Next Critical Moment

or

Return to Preparation Plan

Users are never forced to practice Critical Moments in a specific order.

They may move freely throughout their Preparation Plan and spend as much or as little time on each moment as they choose.

The objective is deliberate practice, not completing a checklist.

---

### **Recommended Time**

Every Critical Moment includes a recommended speaking time generated by Cognify.

Examples:

* Tell Me About Yourself — 90 seconds  
* Behavioral Interview Answer — 2 minutes  
* Presentation Opening — 60 seconds

The recommended time appears only on the rep screen.

Users may edit the recommended time before beginning if they want it to better reflect their real-world situation.

A timer remains visible throughout the rep.

The purpose of the timer is not grading.

The purpose is to recreate the time pressure users are likely to experience during the actual communication event.

## **7.8 Full Simulation**

Full Simulation is designed for users who want to practice an entire communication event from beginning to end.

Rather than focusing on one Critical Moment at a time, users complete the communication event without interruption, allowing them to experience the flow, pacing, and pressure of the real situation.

The objective is not to receive coaching during the simulation.

The objective is to test overall readiness.

---

### **Communication Framework**

Before the simulation begins, Cognify automatically generates a communication framework based on the communication event and any additional context provided.

The framework is built using the same Critical Moments that would be used in Guided Practice.

Examples:

### **Wedding Toast**

* Opening  
* Main Story  
* Reflection  
* Message to the Couple  
* Closing

### **Investor Pitch**

* Opening  
* Problem  
* Solution  
* Market  
* Business Model  
* Closing

### **Team Presentation**

* Opening  
* Current State  
* Key Insights  
* Recommendation  
* Next Steps  
* Closing

The framework appears alongside the simulation as a lightweight reference.

Its purpose is simply to help users organize their thoughts while speaking.

The framework is **not**:

* A checklist  
* A progress tracker  
* A navigation system

Users may:

* Add sections  
* Remove sections  
* Rename sections  
* Reorder sections

They may also ignore the framework entirely and deliver the communication event however they choose.

---

### **Full Simulation Flow**

Each Full Simulation follows the same experience.

Recommended Time (editable)

↓

Communication Framework Visible

↓

Rep

↓

Readiness Review

Unlike Guided Practice, the simulation is never interrupted.

Feedback is delivered only after the communication event has been completed.

---

### **Recommended Time**

Every Full Simulation includes a recommended duration generated by Cognify.

Examples:

* Wedding Toast — 4 minutes  
* Investor Pitch — 10 minutes  
* Team Presentation — 15 minutes

The recommended time appears only on the simulation screen.

Users may edit the time before beginning if they want it to better reflect their real-world situation.

A timer remains visible throughout the simulation.

The purpose of the timer is to recreate the time pressure users are likely to experience during the real communication event.

---

## **7.9 Readiness Review**

The Readiness Review is the final step of every Build a Rep.

Its purpose is to answer one question:

**“How prepared am I for my upcoming communication event?”**

Unlike the feedback received throughout Daily Workout or Guided Practice, the Readiness Review evaluates the user’s overall performance across the entire preparation experience.

### **Readiness Review Structure**

Overall Communication Score

↓

Coach Feedback

↓

Core Skill Breakdown

↓

Readiness Summary

### **Overall Communication Score**

Provides an overall assessment of the user’s communication performance throughout the simulation.

---

### **Coach Feedback**

Identifies the single highest-impact improvement the user should focus on before the real communication event.

The objective is to give users one clear area of focus rather than overwhelming them with too many recommendations.

---

### **Core Skill Breakdown**

Displays performance across the six Core Skills:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

Each Core Skill can be expanded to show:

* Why the user received that score  
* What they did well  
* What they should improve before the real event

---

### **Readiness Summary**

Provides a concise summary of the user’s overall readiness.

The summary should communicate:

* Overall preparedness  
* Primary strengths  
* Primary improvement opportunity  
* Overall confidence heading into the communication event

The objective is to leave users knowing exactly how prepared they are and what they should focus on before the real event.

---

## **7.10 MVP Scope**

The MVP version of Build a Rep is intentionally focused on communication events where users can effectively prepare and practice their own delivery.

Examples include:

* Job Interviews  
* Presentations  
* Investor Pitches  
* Wedding Toasts  
* Product Demos  
* Speeches  
* Team Meetings  
* Meeting Updates  
* Prepared Remarks

These communication events allow users to meaningfully rehearse their own performance without requiring another participant.

Keeping the MVP focused allows Build a Rep to deliver a high-quality preparation experience without introducing unnecessary complexity.

---

## **7.11 Future Expansion**

The MVP version of Build a Rep focuses on communication events where users can effectively prepare and practice their own delivery.

However, many real-world communication events are fundamentally conversational. Success depends not only on what the user says, but also on how they respond to another person’s questions, objections, emotions, and unexpected reactions.

Examples include:

* Discovery Calls  
* Sales Calls  
* Networking Conversations  
* Difficult Conversations  
* Performance Reviews  
* Negotiations  
* Manager Conversations  
* Customer Conversations

These communication events require an AI that behaves less like a coach and more like another participant in the conversation.

Future versions of Build a Rep may introduce conversational simulations capable of recreating these interactions.

Examples of future capabilities include:

* **Dynamic Follow-Up Questions**  
   The AI asks intelligent follow-up questions based on the user’s previous response rather than following a fixed script.  
* **Realistic Pushback**  
   The AI introduces objections, skepticism, requests for clarification, or disagreement that the user must respond to in real time.  
* **Event-Specific Behavior**  
   The AI behaves differently depending on the scenario. For example, a hiring manager should communicate differently than a prospect, executive, customer, or investor.  
* **Conversational Unpredictability**  
   Conversations become less scripted and more realistic by introducing unexpected questions, topic changes, interruptions, and natural dialogue.  
* **Rich Conversational Memory**  
   The AI remembers information shared earlier in the conversation and references it naturally later, creating a more believable and continuous interaction.

These capabilities represent the long-term vision for Build a Rep, but are intentionally outside the scope of the MVP.

The initial version should focus on helping users prepare and refine their own communication. Once that experience is strong, future iterations can expand into fully interactive conversational simulations.

---

## **7.12 Success Criteria**

Build a Rep is successful if users leave feeling meaningfully more prepared for their upcoming communication event.

Success is not determined by achieving a perfect score.

Success is determined by readiness.

Users should leave Build a Rep with:

* Greater confidence  
* A clearer understanding of what to expect  
* Practice on the communication moments most likely to matter  
* Actionable coaching they can immediately apply  
* A higher likelihood of performing well during the real event

The ultimate purpose of Build a Rep is simple:

**Help users walk into important communication events feeling prepared rather than uncertain.**

# 🚂 Build a Rep Engine V1

# Section 8: Communication Intelligence System

## **![][image1]**

## 

## **8.1 Purpose**

The Personalization System is the intelligence layer that powers Cognify.

Its purpose is to continuously adapt the training experience to each user while removing as much decision fatigue as possible.

Rather than asking users to determine what they should practice, which skills need work, which exercises are most appropriate, or what they should focus on next, Cognify makes those decisions automatically using each user’s Communication Profile.

Every rep provides new information about how a user communicates. Over time, Cognify develops a deeper understanding of their strengths, weaknesses, improvement trends, learning patterns, and communication behaviors. This allows the platform to deliver increasingly personalized workouts, exercises, coaching, recommendations, and preparation experiences.

The objective of personalization is not simply to recommend different content for different users.

The objective is to create a communication coach that becomes more intelligent with every rep completed.

As users improve, Cognify continuously learns from their progress, allowing every future training decision to become more personalized and more effective.

The guiding principle behind the Personalization System is simple:

**The user should focus on practicing. Cognify should handle everything else.**

## **8.2 User Profile**

**The User Profile is the foundation of the Personalization System.**

**Its purpose is to maintain the information Cognify needs to understand each user’s goals, communication context, preferences, and overall journey within the platform.**

**The User Profile does not measure how well a user communicates. Instead, it provides the context Cognify uses to personalize the user’s overall experience.**

---

### **Basic Profile**

**The User Profile maintains basic account information, including:**

* **Name**  
* **Account information**  
* **Date joined**

---

### **Communication Stage**

**Users select the stage that best represents where they are in their communication journey.**

**Examples include:**

* **Student**  
* **Early Career**  
* **Individual Contributor**  
* **Manager**  
* **Senior Leader**  
* **Executive**

**Communication Stage provides important context for personalization. While it does not influence scoring, it allows Cognify to generate more relevant prompts, scenarios, coaching examples, and recommendations.**

**As Cognify grows, Communication Stage also enables benchmarking across different career stages, helping identify communication trends and development patterns at scale.**

**Examples of future insights include:**

* **Managers consistently struggle with Giving Feedback.**  
* **Early-career professionals improve Thinking Quality faster than Executive Communication.**  
* **Executives score highest in Structure but lowest in Conciseness.**

---

### **Communication Context**

**The User Profile captures the environment in which users most commonly communicate.**

**Examples include:**

#### **Primary Industry**

* **Sales**  
* **Consulting**  
* **Finance**  
* **Healthcare**  
* **Technology**  
* **Education**  
* **Marketing**  
* **Other**

#### **Typical Audience**

* **Executive**  
* **Manager**  
* **Customer**  
* **Prospect**  
* **Team**  
* **Interviewer**  
* **Investor**  
* **General Audience**

**This context helps Cognify generate more relevant prompts, scenarios, recommendations, and coaching.**

---

### **Communication Goals**

**Users may select one or more long-term communication goals.**

**Examples include:**

* **Become a better presenter**  
* **Improve interviewing**  
* **Become more persuasive**  
* **Improve storytelling**  
* **Speak with more confidence**  
* **Become a stronger leader**  
* **Improve executive communication**

**These goals help Cognify prioritize recommendations and guide users toward the training experiences that best support what they are trying to achieve.**

---

### **Training Preferences**

**The User Profile stores training preferences that personalize the overall experience.**

**Examples include:**

* **Preferred training days**  
* **Weekly training goal**  
* **Reminder preferences**

**These preferences help Cognify support long-term consistency while adapting to each user’s preferred training habits.**

---

### **Communication History**

**The User Profile maintains a history of the user’s activity across Cognify.**

**This includes:**

* **Daily Workouts completed**  
* **Lab sessions completed**  
* **Build a Rep sessions completed**  
* **Total reps completed**

**For Build a Rep, Cognify also remembers the communication events users have previously prepared for.**

**Examples include:**

* **SDR Interview**  
* **Quarterly Business Review**  
* **Investor Pitch**  
* **Wedding Toast**  
* **Product Demo**

**Maintaining this history allows Cognify to understand each user’s communication journey and provide increasingly relevant recommendations over time.**

---

### **Progress & Activity**

**The User Profile tracks high-level progress and engagement metrics that help users visualize their communication journey while providing additional context for personalization.**

#### **Training Activity**

* **Current streak**  
* **Longest streak**  
* **Total practice days**  
* **Total sessions completed**  
* **Total reps completed**  
* **Total retries completed**  
* **Total practice time**  
* **Total time in Cognify**

#### **Product Activity**

* **Daily Workouts completed**  
* **Lab sessions completed**  
* **Build a Rep sessions completed**

#### **Learning Journey**

* **Date joined**  
* **Days actively training**  
* **Milestones achieved *(future)***  
* **Badges *(future)***  
* **Personal bests *(future)***

**The User Profile provides the context Cognify needs to personalize the user’s overall experience and serves as the foundation for the Communication Profile, which continuously learns how each user communicates.**

# 8.3 Communication Profile

# **s8.3 Communication Profile**

## **8.3.1 Purpose**

The Communication Profile is the central intelligence model that powers Cognify.

Its purpose is to continuously measure, understand, and improve how each user communicates.

Unlike the User Profile, which stores information about who the user is and their journey within Cognify, the Communication Profile stores Cognify’s current understanding of the user’s communication ability.

It is the source of truth for every intelligent decision made throughout the platform.

Every rep completed within Cognify contributes new information to the Communication Profile.

Every personalization system within Cognify reads from it.

This includes:

* Adaptive Training  
* Adaptive Exercise Selection  
* Adaptive Coaching  
* Recommendation Engine  
* Longitudinal Learning  
* Future Communication Intelligence features

Rather than treating every communication exercise as an isolated event, Cognify continuously builds a richer understanding of the user over time.

The Communication Profile is not a record of previous scores.

It is Cognify’s best estimate of how the user currently communicates.

---

# **8.3.2 Design Principles**

The Communication Profile follows several core design principles that guide how every personalization system within Cognify operates.

---

### **One Communication Profile**

Every user has a single Communication Profile.

Regardless of whether the user completes a Daily Workout, trains in The Lab, or practices inside Build a Rep, every communication experience contributes to the same Communication Profile.

There are not separate communication profiles for different product experiences.

There is one continuously evolving understanding of the user.

---

### **Every Rep Contributes**

Every completed rep provides additional information about how a user communicates.

Each rep updates the Communication Profile, allowing Cognify to become progressively more accurate as additional evidence is collected.

No rep exists in isolation.

Every communication experience contributes to a larger understanding of the user.

---

### **Core Skills Are Universal**

The six Core Skills serve as the universal scoring framework across the entire platform.

Every rep, regardless of where it occurs, is evaluated using the same six Core Skills:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

This creates one consistent measurement system throughout Cognify.

Whether users are completing a Daily Workout, practicing Storytelling inside The Lab, or preparing for an interview in Build a Rep, every communication experience contributes evidence toward the same Core Skill Performance.

---

### **Hidden Skills Power Personalization**

Core Skill Subskills and Application Skills are intentionally hidden from users.

These skills exist to improve Cognify’s intelligence rather than create additional complexity for the user.

Hidden skills power:

* Exercise selection  
* Prompt selection  
* Coaching personalization  
* Recommendation Engine  
* Mastery tracking  
* Long-term personalization

Users train these skills indirectly without needing to understand the underlying architecture.

---

### **Communication Profile ≠ Rep History**

Individual rep scores are not direct representations of a user’s communication ability.

Rep scores measure performance on a specific communication exercise.

The Communication Profile measures the user’s overall communication ability.

Each rep acts as an additional piece of evidence that helps Cognify refine its understanding of the user over time.

This prevents long-term progress from fluctuating dramatically due to unfamiliar prompts, new exercises, or more difficult communication scenarios.

The Communication Profile should represent meaningful communication growth rather than short-term performance variation.

### **Users Make Motivational Decisions. Cognify Makes Training Decisions.**

One of the core design principles of Cognify is separating motivational decisions from training decisions.

Users control the parts of the experience that increase engagement and ownership, while Cognify controls the decisions that maximize communication improvement.

**Users decide things such as:**

* When to practice  
* Which prompt to complete (from a curated set)  
* Which communication application to practice  
* Whether to retry a rep  
* Guided Practice vs Full Simulation

**Cognify decides things such as:**

* Which Core Skill to prioritize  
* Which hidden skill is being trained  
* Which exercises to surface  
* Which coaching to deliver  
* Which recommendations to make  
* How training adapts over time

This separation allows Cognify to remain highly personalized while avoiding unnecessary decision fatigue.

---

# **8.3.3 Communication Profile Architecture**

The Communication Profile is composed of six primary components.

Communication Profile

├── Core Skill Performance  
│  
├── Core Skill Subskill Performance  
│  
├── Application Performance  
│  
├── Application Skill Performance  
│  
├── Build a Rep Readiness  
│  
├── Coaching History  
│  
└── Improvement Trends

Each component stores a different layer of communication intelligence.

Together, they create a complete representation of how a user communicates.

Every training experience contributes to one or more of these components.

Every personalization system reads from them.

This architecture allows Cognify to continuously evolve alongside the user while maintaining a single source of truth for communication development.

Every intelligent system within Cognify begins with the Communication Profile.

Rather than maintaining separate sources of truth for recommendations, coaching, personalization, and adaptive training, every system reads from the same Communication Profile.

This ensures the platform develops one continuously improving understanding of how each user communicates.

## **8.3.4 Core Skill Performance**

Core Skill Performance represents Cognify’s current estimate of a user’s communication ability across the six foundational communication skills.

These six Core Skills are the universal scoring framework used throughout the entire platform.

Every communication experience—regardless of product—contributes to these six skills.

The six Core Skills are:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

Unlike individual rep scores, Core Skill Performance should not fluctuate dramatically after a single exercise.

Instead, it should evolve gradually as Cognify gathers additional evidence about how the user communicates over time.

The objective is to measure long-term communication development rather than short-term exercise performance.

### **Rep Scores vs Core Skill Performance**

It is important to distinguish between an individual rep score and a Core Skill score.

A Rep Score measures how the user performed on one specific communication exercise.

A Core Skill score represents Cognify’s current understanding of the user’s overall ability within that communication skill.

Individual rep scores are inputs.

Core Skill Performance is the continuously updated output.

This distinction allows the Communication Profile to remain stable even when users encounter unfamiliar prompts, new exercises, or more difficult communication scenarios.

### **Why This Exists**

Core Skill Performance creates one consistent communication language across the entire platform.

Regardless of whether users are completing a Daily Workout, practicing Storytelling inside The Lab, or preparing for an interview in Build a Rep, every communication experience contributes toward the same six Core Skills.

This allows Cognify to measure communication development consistently across every training experience.

### **Updated By**

Core Skill Performance is updated by:

* Daily Workout  
* The Lab  
* Build a Rep

Every completed rep contributes new evidence toward Cognify’s understanding of the user’s Core Skill Performance.

### **Read By**

Core Skill Performance is used by:

* Adaptive Training  
* Adaptive Exercise Selection  
* Adaptive Coaching  
* Recommendation Engine  
* Longitudinal Learning  
* Communication Snapshot

---

## **8.3.5 Core Skill Subskill Performance**

Each Core Skill is composed of a collection of hidden Core Skill Subskills.

These subskills represent the specific communication behaviors that collectively determine success within each Core Skill.

For example:

Clarity

↓

* Word Choice  
* Precision  
* Concreteness  
* Audience Awareness  
* Idea Isolation  
* Logical Sequencing

Users never see these subskills directly.

Instead, they exist to improve Cognify’s ability to personalize training and coaching.

### **Purpose**

Core Skill Subskills provide significantly greater resolution than the six Core Skills alone.

Rather than simply identifying that a user struggles with Clarity, Cognify can determine why.

Examples include:

* Weak Word Choice  
* Poor Audience Awareness  
* Low Precision  
* Weak Logical Sequencing

This allows Cognify to generate much more targeted exercises and coaching.

### **Hidden by Design**

Core Skill Subskills are intentionally hidden from users.

Showing dozens of communication metrics would introduce unnecessary complexity and decision fatigue.

Instead, Cognify uses these hidden measurements internally while presenting users with a much simpler experience focused on the six Core Skills.

### **Updated By**

Core Skill Subskill Performance is primarily updated through Daily Workout.

Daily Workout is designed to isolate and strengthen individual communication behaviors, making it the most effective environment for measuring Core Skill Subskills.

### **Read By**

Core Skill Subskill Performance is used by:

* Adaptive Exercise Selection  
* Adaptive Coaching  
* Recommendation Engine  
* Future personalization systems

---

## **8.3.6 Application Performance**

Application Performance measures communication ability within specific real-world communication applications.

Examples include:

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

Unlike Core Skills, which represent foundational communication abilities, Application Performance represents how effectively users apply those abilities within a specific communication context.

### **How Application Scores Are Calculated**

Application Scores are derived from a user’s Core Skill Performance across exercises completed within that application.

For example:

A Storytelling score is built from historical Core Skill Performance across Storytelling reps.

Application Skills do **not** determine the Application Score.

Instead, they provide additional context that improves coaching and personalization.

This ensures every score within Cognify is built upon one consistent communication framework.

### **Purpose**

Application Performance allows Cognify to measure long-term growth within specific communication applications while maintaining consistent Core Skill scoring across the platform.

Users can improve Storytelling, Presenting, or Interviewing independently while still strengthening the same foundational communication skills.

### **Updated By**

Application Performance is updated by:

* The Lab

### **Read By**

Application Performance is used by:

* Recommendation Engine  
* Adaptive Training  
* Communication Snapshot  
* Longitudinal Learning

---

## **8.3.7 Application Skill Performance**

Every communication application contains its own hidden Application Skills.

These skills represent the behaviors that define success within a specific communication application.

For example:

Storytelling

↓

* Narrative Arc  
* Emotional Engagement  
* Character Development  
* Tension Building  
* Resolution

Presenting

↓

* Slide Transitions  
* Audience Engagement  
* Visual Integration  
* Message Reinforcement

These skills are specific to their application and are not shared across the rest of the platform.

### **Purpose**

Application Skills exist to make coaching significantly more intelligent.

They help Cognify understand not only that a user struggled within Storytelling, but exactly which storytelling behaviors need improvement.

Application Skills are **not** used to calculate rep scores.

Rep scores are always determined by the six Core Skills.

Instead, Application Skills improve:

* Coach’s Insight  
* Coach’s Focus  
* Exercise selection  
* Prompt generation  
* Mastery tracking  
* Future recommendations

### **Hidden by Design**

Like Core Skill Subskills, Application Skills are intentionally hidden from users.

They exist to power Cognify’s intelligence rather than increase interface complexity.

### **Updated By**

Application Skill Performance is updated by:

* The Lab

### **Read By**

Application Skill Performance is used by:

* Adaptive Exercise Selection  
* Adaptive Coaching  
* Recommendation Engine  
* Longitudinal Learning

## **8.3.8 Build a Rep Readiness**

Build a Rep Readiness represents Cognify’s understanding of a user’s preparedness for specific communication events.

Unlike Core Skill Performance, which measures foundational communication ability across all communication experiences, Build a Rep Readiness is event-specific.

Examples include:

* SDR Interview  
* Product Demo  
* Quarterly Business Review  
* Investor Pitch  
* Wedding Toast  
* Sales Presentation  
* Executive Presentation

Each communication event maintains its own readiness profile.

Readiness is not represented by one universal score across all communication events. Instead, Cognify independently develops an understanding of how prepared a user is for each communication event they practice.

This readiness is used internally to personalize future Build a Rep experiences rather than serve as another user-facing score.

### **Purpose**

Build a Rep Readiness exists to answer one question:

**“How prepared is this user for this specific communication event?”**

This allows Cognify to:

* Personalize future Build a Rep sessions  
* Recommend additional practice when needed  
* Track preparation progress over time  
* Generate more relevant coaching for that event

### **Relationship to Core Skills**

Every rep inside Build a Rep is still scored using the six Core Skills:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

These Core Skill scores continue contributing to the user’s overall Communication Profile.

Build a Rep Readiness does **not** replace Core Skill scoring.

Instead, it provides additional event-specific context that helps Cognify better understand how prepared the user is for that particular communication event.

### **Updated By**

Build a Rep Readiness is updated by:

* Build a Rep

### **Read By**

Build a Rep Readiness is used by:

* Future Build a Rep sessions  
* Adaptive Coaching  
* Recommendation Engine  
* Communication Snapshot

---

## **8.3.9 Coaching History**

Coaching History enables Cognify to remember how each user has developed over time.

Rather than treating every rep as an isolated interaction, Cognify continuously builds upon previous coaching so feedback becomes increasingly personalized as users improve.

### **Purpose**

The goal of Coaching History is to make Cognify behave like a real communication coach.

As users develop, coaching should evolve alongside them.

The system should understand:

* What has already been coached  
* What behaviors have already been mastered  
* What users continue struggling with  
* Which coaching techniques successfully improve performance

This prevents repetitive coaching while ensuring feedback continues progressing alongside the user’s development.

### **Coaching History Stores**

Examples include:

* Previous Coach’s Focus  
* Previously mastered behaviors  
* Recurring weaknesses  
* Successful coaching implementations  
* Coaching progression over time  
* Coaching effectiveness

### **Updated By**

Coaching History is updated by:

* Daily Workout  
* The Lab  
* Build a Rep

### **Read By**

Coaching History is used by:

* Adaptive Coaching  
* Recommendation Engine  
* Communication Snapshot

---

## **8.3.10 Improvement Trends**

Improvement Trends identify long-term communication development across the platform.

Rather than evaluating individual reps, Improvement Trends analyze historical communication data to understand how users are progressing over time.

Every trend should be generated from measurable user behavior rather than assumptions.

### **Performance Trends**

Examples include:

* Improving Skills  
* Plateauing Skills  
* Declining Skills  
* Most Improved Core Skill  
* Most Consistent Core Skill  
* Fastest Improving Application

### **Engagement Trends**

Examples include:

* Practice consistency  
* Retry frequency  
* Session frequency  
* Average practice time  
* Practice streaks  
* Training consistency

These trends provide additional context that helps Cognify personalize future training while helping users understand their long-term communication development.

### **Updated By**

Improvement Trends are updated by:

* Daily Workout  
* The Lab  
* Build a Rep

### **Read By**

Improvement Trends are used by:

* Adaptive Training  
* Recommendation Engine  
* Longitudinal Learning  
* Communication Snapshot

---

## **8.3.11 Communication Snapshot**

The Communication Snapshot is a dynamic representation of the user’s current communication state.

It is generated from the Communication Profile and serves as the starting point for every intelligent decision made throughout Cognify.

The Communication Snapshot is **not** stored independently.

Instead, it is continuously regenerated as the Communication Profile evolves.

### **Purpose**

The purpose of the Communication Snapshot is to provide Cognify with one up-to-date understanding of the user before making any personalization decision.

Rather than reading every component of the Communication Profile individually, Cognify first generates a Communication Snapshot that summarizes the user’s current communication state.

Every intelligent system within Cognify begins here.

Examples include:

* Adaptive Training  
* Adaptive Exercise Selection  
* Adaptive Coaching  
* Recommendation Engine

### **Example Snapshot Information**

The Communication Snapshot may include information such as:

* Strongest Core Skill  
* Biggest opportunity for improvement  
* Strongest communication application  
* Current coaching priorities  
* Current communication trends  
* Recommended next training experience

The exact contents of the Communication Snapshot will continue evolving as Cognify becomes more intelligent over time.

---

## **8.3.12 How Cognify Learns**

Every communication experience follows the same intelligence pipeline. **Regardless of whether a user completes a Daily Workout, practices in The Lab, or prepares for a real-world event in Build a Rep, every rep moves through the same learning architecture.**

**User Completes Rep**

**↓**

**AI Evaluates Communication**

**↓**

**Core Skills Scored**

**↓**

**Hidden Skills Updated**

**(Core Skill Subskills / Application Skills)**

**↓**

**Communication Profile Updated**

**↓**

**Communication Snapshot Generated**

**↓**

**Adaptive Training Updated**

**Adaptive Coaching Updated**

**Recommendation Engine Updated**

**↓**

**Next Rep Becomes More Personalized**

This flow represents the core intelligence engine behind Cognify.

Every completed rep contributes new evidence about how a user communicates.

That evidence updates the Communication Profile.

The updated Communication Profile generates a new Communication Snapshot.

Every personalization system then reads from that snapshot before making future training, coaching, and recommendation decisions.

The result is a platform that continuously becomes more personalized as users practice.

**The goal of the Communication Profile is not to remember everything a user has done. The goal is to understand how they communicate well enough that every future rep becomes more effective than the last.**

### **Communication Profile Summary**

**The Communication Profile serves as the central intelligence layer for the entire platform.**

**Every completed rep contributes new evidence about how a user communicates.**

**That evidence continuously updates Cognify’s understanding of the user.**

**Every intelligent system—including adaptive training, coaching, recommendations, and future personalization features—reads from that same understanding before making decisions.**

**As a result, Cognify becomes more personalized with every rep completed.**

# 8.4 Adaptive Learning System

# **8.4 Adaptive Learning System**

The Adaptive Learning System defines how Cognify uses the Communication Profile to make intelligent training decisions across the platform.

Its purpose is simple:

**Ensure every rep creates the greatest possible long-term communication improvement.**

Rather than relying on static learning paths or allowing users to build their own training plans, Cognify continuously analyzes how users communicate and determines the highest-value training experience for them.

Adaptive learning is not a single system.

Because Daily Workout, The Lab, and Build a Rep serve different purposes, each experience requires its own adaptive engine.

* **Daily Workout** determines **what** the user should train.  
* **The Lab** determines **how** the user should train within a chosen communication application.  
* **Build a Rep** determines **how** the user should prepare for a chosen real-world communication event.

Although these engines make different decisions, they all read from the same Communication Profile.

This ensures Cognify maintains one continuously evolving understanding of how each user communicates.

The guiding philosophy of the Adaptive Learning System is:

**Every adaptive engine exists to maximize the long-term value of the user’s next rep.**

The objective is not to maximize today’s performance.

The objective is to maximize long-term communication development.

---

# **8.4.1 Adaptive Learning Principles**

Every adaptive decision within Cognify should follow the same core principles.

These principles guide how personalization is designed throughout the platform and should be used whenever new adaptive systems are introduced.

---

### **1\. Understand Before Personalizing**

Cognify should never assume it understands a user’s communication ability after only a few reps.

Personalization should only become more aggressive as additional evidence is collected.

The better Cognify understands the user, the better its recommendations become.

---

### **2\. Optimize Long-Term Communication Development**

Adaptive learning should never optimize for today’s score alone.

Likewise, it should not simply attack the user’s weakest skill every day.

Instead, every decision should maximize long-term communication development.

Sometimes that means prioritizing weaknesses.

Sometimes it means reinforcing strengths.

Sometimes it means introducing variety or changing the type of challenge.

The best next rep is not always the rep that targets the weakest skill.

It is the rep that creates the greatest long-term improvement.

---

### **3\. Users Make Motivational Decisions. Cognify Makes Training Decisions.**

One of Cognify’s core product philosophies is separating motivational decisions from training decisions.

Users control the parts of the experience that increase ownership and engagement.

Examples include:

* Choosing one of four prompts  
* Choosing a communication application in The Lab  
* Choosing a communication event in Build a Rep  
* Choosing Guided Practice or Full Simulation  
* Choosing whether to retry

Cognify controls the decisions that require coaching expertise.

Examples include:

* Which Core Skill to train  
* Which hidden skill to target  
* Which exercise to assign  
* Which prompts to generate  
* Which coaching to provide  
* Which recommendations to make

This separation minimizes decision fatigue while maximizing communication improvement.

---

### **4\. Every Rep Improves the Communication Profile**

Every completed rep provides additional evidence about how the user communicates.

That evidence continuously updates the Communication Profile.

As the Communication Profile becomes more accurate, every adaptive engine becomes more intelligent.

No rep exists in isolation.

Every communication experience contributes to a larger understanding of the user.

---

### **5\. Personalization Should Continuously Improve**

The Adaptive Learning System should become smarter over time.

Brand-new users should receive broad, balanced training while Cognify learns how they communicate.

As more evidence is collected, training should become increasingly individualized.

The longer someone uses Cognify, the more accurately the platform should understand:

* Their strengths  
* Their weaknesses  
* Their communication habits  
* Their coaching needs  
* Their ideal level of challenge  
* Their long-term development opportunities

The quality of personalization should improve alongside the quality of the Communication Profile.

---

# **8.4.2 Assessment Phase**

Every new user begins Cognify with an empty Communication Profile.

At this stage, Cognify has very little information about how the user communicates.

It does not yet know:

* Their strongest Core Skills  
* Their weakest Core Skills  
* Which communication behaviors need the most attention  
* Which coaching strategies are most effective  
* How they perform across different communication contexts

Because of this, Cognify should **not immediately begin aggressively personalizing training.**

Instead, every new user enters the **Assessment Phase.**

The purpose of the Assessment Phase is to establish an accurate communication baseline before adaptive training begins.

---

## **Purpose**

The objective of the Assessment Phase is not to determine what the user should practice.

The objective is to understand **how the user currently communicates.**

Rather than making assumptions from one or two reps, Cognify intentionally gathers evidence across all six Core Skills before making meaningful training decisions.

This creates a Communication Profile built on patterns instead of isolated performances.

---

## **Initial Core Skill Rotation**

During the Assessment Phase, Daily Workout should expose users to every Core Skill through a balanced rotation.

For example:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

Completing one rotation provides an initial understanding of the user’s communication ability.

A second rotation strengthens that understanding by collecting additional evidence across each skill.

The exact number of baseline reps may evolve as the product matures.

However, the principle should remain constant:

**Cognify should collect enough evidence before heavily personalizing training.**

---

## **Broad Assessment**

Assessment should evaluate users across more than just the six Core Skills.

To build a representative Communication Profile, Cognify should intentionally expose users to different:

* Exercise types  
* Prompt styles  
* Communication contexts  
* Time constraints  
* Coaching focuses

This allows Cognify to observe how users communicate under different conditions rather than drawing conclusions from a narrow set of experiences.

A stronger baseline produces better personalization throughout the rest of the platform.

---

## **Transition to Adaptive Learning**

The Assessment Phase should gradually transition into adaptive learning as Cognify gains confidence in the Communication Profile.

The progression should feel natural rather than abrupt.

Early experience:

**Balanced Core Skill rotation**

↓

Growing understanding:

**Light personalization begins**

↓

Mature Communication Profile:

**Fully adaptive learning**

As Cognify gathers additional evidence, training decisions become increasingly personalized.

The system moves from learning about the user to coaching the user.

This transition should happen seamlessly without requiring any action from the user.

---

# **8.4.3 Daily Workout Training Engine**

Once the Assessment Phase establishes a reliable Communication Profile, Daily Workout becomes Cognify’s primary long-term communication development engine.

Unlike every other product experience, Daily Workout is responsible for deciding **what** users should practice next.

Users do not build their own Daily Workout.

They simply show up ready to train.

Cognify analyzes the Communication Profile, determines the highest-value training opportunity, and builds the workout automatically.

Daily Workout is the only experience within Cognify that actively manages the user’s long-term communication development plan.

Its responsibility is not simply to generate today’s workout.

Its responsibility is to continuously develop better communicators over weeks, months, and years.

## **8.4.4 Daily Workout Training Engine continued…**

Daily Workout is Cognify’s primary long-term communication development engine.

Unlike The Lab and Build a Rep, Daily Workout is responsible for deciding **what users should practice next.**

Every Daily Workout is generated using the user’s Communication Profile, Communication Snapshot, recent training history, coaching history, and long-term improvement trends.

The objective is not to create the best workout for today.

The objective is to create the greatest long-term communication improvement.

Users should feel like they are walking into a gym where a personal trainer has already designed the perfect workout for them.

---

### **What Daily Workout Decides**

For every Daily Workout, Cognify automatically determines:

* Which Core Skill should be trained  
* Which Core Skill Subskills should be targeted  
* Which exercise should be completed  
* Which four prompt options should be generated  
* The difficulty and challenge level of the workout  
* The coaching focus for each exercise

The user is intentionally removed from these decisions.

Instead, they simply complete the workout Cognify has prepared.

This minimizes decision fatigue while maximizing communication improvement.

---

# **Adaptive Training Priorities**

Daily Workout should never optimize around a single objective.

A great communication coach balances multiple priorities simultaneously.

Daily Workout should behave the same way.

Every workout should balance the following priorities before deciding what the user trains next.

---

### **Weak Skill Prioritization**

Communication skills that consistently underperform should receive additional attention.

If a user repeatedly struggles with Thinking Quality or Conciseness, Cognify should gradually increase opportunities to practice those skills.

However, weaker skills should never completely dominate the training plan.

The objective is to reduce meaningful communication gaps while maintaining balanced development across all six Core Skills.

---

### **Strong Skill Maintenance**

Strong communication skills still require reinforcement.

Without continued practice, strengths can plateau or gradually decline over time.

Daily Workout should periodically revisit high-performing Core Skills to maintain long-term communication ability.

The goal is to produce complete communicators, not specialists.

---

### **Plateau Detection & Intervention**

Communication improvement is rarely linear.

If Cognify detects that progress within a Core Skill has slowed or stopped, it should adjust the training strategy rather than simply assigning additional repetitions.

Potential interventions include:

* Targeting different hidden subskills  
* Selecting different exercise formats  
* Changing prompt styles  
* Introducing new communication contexts  
* Increasing or decreasing time pressure  
* Changing the coaching focus  
* Varying the type of cognitive challenge

The objective is not repetition.

The objective is renewed improvement.

---

### **Intelligent Variety**

Training should remain engaging over months and years.

Even when Cognify is prioritizing a weak Core Skill, it should intentionally vary how that skill is trained.

Variety may come through:

* Different exercise types  
* Different prompt topics  
* Different communication contexts  
* Different hidden subskills  
* Different speaking constraints  
* Different coaching emphasis

Variety should always have a training purpose.

Randomness creates inconsistency.

Intentional variety creates broader communication ability and keeps the product engaging.

---

### **Confidence Management**

Daily Workout should continuously balance challenge with confidence.

The goal is not to make every workout as difficult as possible.

The goal is to keep users within an environment that maximizes learning while maintaining motivation.

Some workouts should intentionally push users beyond their comfort zone.

Others should reinforce progress and allow users to experience success.

Confidence is not treated as a separate score.

Instead, it is a factor considered when selecting future training.

A great coach knows when to challenge and when to reinforce.

Cognify should behave the same way.

---

### **Long-Term Training Balance**

Daily Workout should balance all six Core Skills over time.

Although weaker skills should receive more attention, users should continue training every Core Skill throughout their communication journey.

The objective is long-term communication mastery rather than short-term score optimization.

No Core Skill should be permanently ignored simply because it is currently a strength.

---

# **Multi-Session Planning**

Daily Workout should never make training decisions in isolation.

Rather than asking:

**“What should the user practice today?”**

Cognify should continuously ask:

**“What sequence of future workouts will create the greatest long-term communication improvement?”**

Training decisions should consider:

* Recently trained Core Skills  
* Recently trained hidden subskills  
* Current improvement trends  
* Plateau detection  
* Communication strengths  
* Communication weaknesses  
* Training variety  
* User confidence  
* Long-term balance across all six Core Skills

The user should never feel like they are following a rigid schedule.

Instead, every workout should simply feel like the right workout at the right time.

---

# **Decision Inputs**

Before generating a Daily Workout, Cognify should evaluate information from across the Communication Profile.

This includes, but is not limited to:

* Core Skill Performance  
* Core Skill Subskill Performance  
* Coaching History  
* Improvement Trends  
* Communication Snapshot  
* Recent Daily Workout history  
* Previously targeted Core Skills  
* Previously targeted hidden subskills  
* Plateau detection  
* Training variety  
* Confidence balancing

No single metric should determine the next workout.

Daily Workout should evaluate the user’s overall communication development before deciding what creates the highest-value next rep.

---

# **Success Criteria**

The Daily Workout Training Engine is successful if users consistently feel that Cognify understands exactly what they need to practice.

A successful engine should:

* Continuously improve long-term communication ability.  
* Eliminate decision fatigue.  
* Prioritize the highest-value communication practice.  
* Balance weak skill improvement with strong skill maintenance.  
* Prevent communication plateaus.  
* Maintain variety without sacrificing intentionality.  
* Balance challenge with confidence.  
* Make every workout feel purposeful.

The ideal Daily Workout experience is simple:

**The user opens Cognify, starts their workout, and trusts that today’s training is exactly what they need to become a better communicator.**

## **8.4.5 Lab Personalization Engine**

The Lab uses adaptive learning differently than Daily Workout.

Unlike Daily Workout, The Lab is **not responsible for deciding what communication application a user should practice.**

That decision belongs entirely to the user.

If a user wants to improve Storytelling, Presenting, Teaching, Interviewing, Persuasion, or another communication application, they simply choose that application.

Once the application has been selected, Cognify takes over.

Its responsibility is to determine the highest-value way to train within that application.

The user chooses **what** they want to improve.

Cognify determines **how** they should improve it.

---

### **Purpose**

The purpose of the Lab Personalization Engine is to maximize improvement within a specific communication application.

Unlike Daily Workout, which builds long-term communication ability across all six Core Skills, The Lab develops mastery within one communication application at a time.

Every Lab session should become increasingly personalized as Cognify learns how the user performs within that application.

---

### **What The Lab Decides**

After the user selects a communication application, Cognify automatically determines:

* Which hidden Application Skill should be trained  
* Which exercise should be assigned  
* Which four prompt options should be generated  
* Which Coach’s Focus should be emphasized  
* Which coaching insights should be delivered  
* The overall challenge level for that session

For example:

The user selects **Storytelling**.

Behind the scenes, Cognify may determine that the user’s greatest opportunity is improving **Narrative Arc**.

Rather than generating a random Storytelling exercise, Cognify intentionally selects an exercise designed to strengthen Narrative Arc while still evaluating communication using the six Core Skills.

The user experiences a simple Storytelling workout.

Behind the scenes, Cognify is delivering highly personalized training.

---

### **Adaptive Personalization Within Applications**

As users spend more time inside an application, Cognify should continuously refine how that application is trained.

For example, within Storytelling, Cognify may learn that a user consistently struggles with:

* Narrative Arc  
* Building tension  
* Smooth transitions  
* Memorable endings

Future Storytelling sessions should gradually prioritize those behaviors until meaningful improvement is observed.

Likewise, if a user consistently performs well within a particular Application Skill, Cognify should introduce new challenges to continue expanding mastery.

Every application should become more intelligent over time.

---

### **Relationship to Core Skills**

Although The Lab focuses on application-specific communication, every rep is still scored using the six Core Skills.

Application Skills do **not** determine the user’s score.

Instead, they provide additional context that helps Cognify understand:

* What communication behavior is being trained.  
* Why the user performed the way they did.  
* What coaching should be delivered.  
* What future exercises should be recommended.

Core Skills remain the universal scoring framework across the entire platform.

Application Skills exist to make personalization significantly more intelligent.

---

### **Success Criteria**

A successful Lab Personalization Engine should:

* Make every application session feel increasingly personalized.  
* Continuously improve hidden Application Skills.  
* Deliver more relevant coaching over time.  
* Increase mastery within individual communication applications.  
* Keep scoring consistent through the six Core Skills.  
* Make users feel like Cognify understands exactly what they need to improve within that application.

---

# **8.4.6 Build a Rep Preparation Engine**

Build a Rep also uses adaptive learning differently than Daily Workout.

Users enter Build a Rep because they already know what communication event they need to prepare for.

Cognify is not responsible for deciding what event users should practice.

Instead, its responsibility is to create the most valuable preparation experience possible for that specific event.

The user chooses the destination.

Cognify designs the preparation.

---

### **Purpose**

The purpose of the Build a Rep Preparation Engine is to maximize readiness for a specific real-world communication event.

Unlike Daily Workout, which develops long-term communication ability, and The Lab, which develops application mastery, Build a Rep focuses on preparing users for something that is directly in front of them.

Every preparation experience should become more personalized as Cognify learns:

* How the user communicates.  
* How they perform within similar communication events.  
* Which coaching produces the greatest improvement.  
* Which preparation strategies work best for that user.

---

### **What Build a Rep Decides**

Once the user provides the communication event and any supporting context, Cognify automatically determines:

* The Preparation Plan  
* Recommended practice mode  
* Critical Moments  
* Communication framework  
* Coach’s Insight  
* Coach’s Focus  
* Recommended time constraint  
* Event-specific coaching  
* Follow-up recommendations after practice

If users upload additional context such as:

* Job descriptions  
* Resumes  
* Presentation decks  
* Meeting agendas  
* Notes  
* Supporting documents

Cognify should incorporate that information into every stage of the preparation experience.

The richer the context, the more personalized the preparation becomes.

---

### **Adaptive Preparation**

Every time a user practices the same communication event, Cognify should become better at preparing them.

Future preparation sessions should build upon:

* Previous coaching  
* Previous retries  
* Previous Improvement Reviews  
* Historical communication performance  
* Event-specific readiness

Rather than restarting from scratch every session, Cognify should continuously refine its preparation strategy.

The objective is to make every future preparation experience more effective than the previous one.

---

### **Relationship to Core Skills**

Every Build a Rep session continues using the six Core Skills as the universal scoring framework.

Build a Rep does not introduce a separate communication scoring system.

Instead:

* Core Skills measure communication performance.  
* Event Readiness measures preparation for that specific event.

This allows Build a Rep to contribute to the same Communication Profile while simultaneously improving preparation for future communication events.

---

### **Success Criteria**

A successful Build a Rep Preparation Engine should:

* Generate highly relevant preparation plans.  
* Create realistic Critical Moments.  
* Personalize coaching using uploaded context.  
* Continuously improve preparation quality.  
* Increase readiness for future communication events.  
* Help users walk into important conversations feeling genuinely prepared.

---

# **8.4.7 Shared Adaptive Principles**

Although each adaptive engine serves a different purpose, they all follow the same design philosophy.

### **One Communication Profile**

Every adaptive engine reads from the same Communication Profile.

Daily Workout, The Lab, and Build a Rep do not maintain separate understandings of the user.

Every communication experience contributes to one continuously evolving Communication Profile.

---

### **One Universal Scoring Framework**

Every communication experience is evaluated using the same six Core Skills.

Regardless of where training occurs, communication performance is always measured consistently.

This creates one universal language for communication improvement across Cognify.

---

### **Hidden Skills Power Personalization**

Core Skill Subskills and Application Skills remain hidden from users.

They exist to improve Cognify’s intelligence rather than increase interface complexity.

These hidden skills help determine:

* Exercise selection  
* Prompt generation  
* Coaching  
* Recommendations  
* Long-term personalization

Users benefit from this intelligence without needing to understand the underlying architecture.

---

### **Users Make Motivational Decisions**

Users decide the things that increase motivation and ownership.

Examples include:

* Choosing one of four prompts  
* Choosing a communication application  
* Choosing a Build a Rep event  
* Choosing Guided Practice or Full Simulation  
* Choosing whether to retry

---

### **Cognify Makes Training Decisions**

Cognify makes the decisions that require diagnosis and coaching expertise.

Examples include:

* What to train in Daily Workout  
* Which hidden skills to prioritize  
* Which exercises to assign  
* Which prompts to generate  
* Which coaching to deliver  
* Which recommendations to make

This separation minimizes decision fatigue while maximizing communication improvement.

---

# **8.4.8 Success Criteria**

The Adaptive Learning System is successful if users consistently feel that Cognify understands exactly what they need to practice.

Users should never feel like they have to figure out how to improve.

Instead, Cognify should quietly make those decisions for them.

A successful Adaptive Learning System should:

* Build an accurate Communication Profile before heavily personalizing.  
* Continuously improve the quality of personalization.  
* Deliver increasingly relevant Daily Workouts.  
* Personalize every Lab session within the chosen application.  
* Personalize every Build a Rep preparation experience.  
* Reduce decision fatigue.  
* Maintain training variety.  
* Prevent communication plateaus.  
* Balance challenge with confidence.  
* Make every rep more valuable than the last.

The ideal user experience is simple:

**Users don’t need to decide how to become better communicators. They simply show up, practice, and trust that Cognify has already prepared the highest-value training experience for them.**

# 8.5 Content Selection System

# **8.5 Content Selection System**

The Content Selection System defines how Cognify’s three adaptive engines determine the exact training content users receive during every communication experience.

While the Adaptive Learning System decides **what** users should work on, the Content Selection System determines **how that training is delivered.**

For example:

The Adaptive Learning System may determine that today’s Daily Workout should focus on:

* Thinking Quality  
* Prioritization

The Content Selection System then determines:

* Which Prioritization exercise should appear  
* Which four prompts should be generated  
* Which communication contexts should be used  
* Which speaking scenario should be presented  
* Which time constraint should be applied

The same principle applies throughout the platform.

Once an adaptive engine determines the training objective, the Content Selection System selects the content that will create the highest-value learning experience.

Its responsibility is not to change **what** users are training.

Its responsibility is to determine the best way to train it.

---

# **8.5.1 Content Selection Philosophy**

Every piece of content within Cognify should exist for a specific training purpose.

Exercises, prompts, communication contexts, speaking scenarios, and time constraints should never be selected randomly.

Instead, every content decision should intentionally reinforce the communication behavior the adaptive engine is trying to develop.

The Content Selection System exists to maximize learning while keeping every training experience engaging, personalized, and fresh.

---

## **Training Objective Remains Constant**

Within a single rep, the training objective should remain constant.

Only the surrounding content should change.

For example:

If Daily Workout determines:

**Core Skill**

* Thinking Quality

**Hidden Core Skill Subskill**

* Prioritization

The user may then receive four prompts such as:

* Prioritize features for a new startup.  
* Prioritize improvements for a local restaurant.  
* Prioritize a vacation itinerary.  
* Prioritize warehouse safety initiatives.

Although each prompt uses a different communication context, every prompt is training the exact same communication behavior.

This allows users to choose a prompt they find interesting without changing the learning objective.

The skill remains constant.

The context changes.

---

## **Assessment Prioritizes Coverage**

During the Assessment Phase, the objective is to expose users to a broad range of training content.

Rather than repeatedly showing similar exercises, Cognify should prioritize coverage across:

* Core Skill Subskills  
* Exercise types  
* Prompt styles  
* Communication contexts  
* Speaking scenarios

This allows Cognify to build a more representative Communication Profile before heavily personalizing future training.

Assessment should prioritize learning about the user rather than optimizing future performance.

---

## **Adaptive Learning Prioritizes Improvement**

Once the Assessment Phase is complete, the Content Selection System shifts its objective.

Rather than maximizing coverage, it begins maximizing communication improvement.

Content selection should become increasingly personalized based on:

* Communication strengths  
* Communication weaknesses  
* Hidden skill performance  
* Coaching history  
* Improvement trends  
* Previous training experiences

The more Cognify understands the user, the more intelligently content should be selected.

---

## **Variety Should Be Intentional**

Training variety should never exist simply to make workouts feel different.

Every variation should have a learning purpose.

The Content Selection System should intentionally vary:

* Exercise types  
* Prompt contexts  
* Speaking scenarios  
* Time constraints

Each variation should strengthen communication transfer by helping users apply the same communication behavior across different situations.

Variety should improve communication ability.

It should never introduce unnecessary randomness.

---

## **Personalization Over Randomness**

As users continue training, the Content Selection System should become increasingly personalized.

Rather than selecting content randomly, Cognify should continuously use the Communication Profile to determine which content is most valuable for the user’s long-term development.

The objective is simple:

**Content should never become predictable. It should become increasingly personalized.**

---

# **8.5.2 Daily Workout Content Selection**

Once the Daily Workout Training Engine determines what the user should train, the Content Selection System determines exactly what that workout will contain.

Its responsibility is to transform the training objective into a complete communication experience.

For every Daily Workout, the Content Selection System determines:

* Which hidden Core Skill Subskill will be trained  
* Which exercise best develops that subskill  
* Which four prompts will be presented  
* Which communication contexts will be used  
* Which speaking scenario will be presented  
* Which time constraint will be applied

Although these decisions occur behind the scenes, they have a significant impact on the quality, variety, and effectiveness of every Daily Workout.

The objective is to ensure every workout feels intentional, personalized, and meaningfully different from previous training experiences.

## **8.5.3 Daily Workout Content Selection**

Once the Daily Workout Training Engine has determined **what** the user should train, the Content Selection System determines **how that training is delivered.**

Every Daily Workout follows the same content selection sequence.

Adaptive Learning System

        ↓

Select Core Skill

        ↓

Select Core Skill Subskill

        ↓

Select Exercise

        ↓

Generate Four Prompt Options

        ↓

User Chooses Prompt

        ↓

Configure Exercise

(Context, Speaking Scenario, Time Pressure, etc.)

Each decision builds upon the previous one.

The output of one step becomes the input for the next.

This creates a structured, repeatable system that allows Cognify to generate personalized Daily Workouts while keeping the user experience simple.

---

### **Step 1: Core Skill Subskill Selection**

Once the Adaptive Learning System has selected today’s Core Skill, the Content Selection System determines which **Core Skill Subskill** within that skill should be trained.

During the Assessment Phase, Cognify should prioritize broad coverage.

The objective is to expose users to every Core Skill Subskill across all six Core Skills in order to establish a reliable performance baseline.

For example, if today’s workout focuses on **Clarity**, Cognify may rotate through subskills such as:

* Audience Awareness  
* Precision  
* Concreteness  
* Idea Isolation  
* Word Choice

Similarly, if today’s workout focuses on **Structure**, Cognify may rotate through subskills such as:

* Bottom-Line Discipline  
* Signposting  
* Narrative Arc  
* Logical Sequencing  
* Transitions

The goal during the Assessment Phase is not to maximize improvement.

The goal is to understand how the user performs across the entire communication framework.

Once sufficient evidence has been collected, Core Skill Subskill selection becomes adaptive.

Rather than rotating evenly, Cognify begins selecting the subskills that will create the greatest long-term communication improvement.

Selection should consider factors such as:

* Historical performance  
* Recent improvement  
* Coaching History  
* Improvement Trends  
* Recently trained subskills  
* Overall balance across the Communication Profile

Subskills that consistently underperform should receive additional attention, while stronger subskills should continue receiving periodic reinforcement.

The objective is balanced communication development rather than repeatedly training the same weaknesses.

---

### **Step 2: Exercise Selection**

Once the Core Skill Subskill has been selected, Cognify determines which exercise will best develop that communication behavior.

Every exercise within Cognify should be mapped to one or more Core Skill Subskills.

For example:

**Core Skill**

Clarity

**Core Skill Subskill**

Audience Awareness

Possible exercises:

* Explain  
* Teach  
* Clarify a misunderstanding  
* Compare two ideas  
* Simplify a complex topic

Although each exercise develops Audience Awareness, each challenges the user in a different way.

During the Assessment Phase, Cognify should prioritize exposing users to new exercises whenever possible.

This provides broader evidence for the Communication Profile while preventing early training from feeling repetitive.

Once adaptive learning begins, exercise selection should become increasingly personalized.

The system should consider:

* Recently completed exercises  
* Recently trained Core Skill Subskills  
* Communication Profile  
* Coaching History  
* Improvement Trends  
* Overall workout variety

Exercises should only be repeated when there is a meaningful training purpose.

Repetition should reinforce learning.

It should never occur simply because the system has exhausted available content.

---

### **Step 3: Prompt Generation**

Once an exercise has been selected, Cognify generates four prompt options.

All four prompts should train the exact same:

* Core Skill  
* Core Skill Subskill  
* Exercise

The only element that changes is the communication context.

For example:

**Core Skill**

Clarity

**Core Skill Subskill**

Audience Awareness

**Exercise**

Explain a concept to someone with limited prior knowledge.

**Prompt Options**

* Explain how artificial intelligence works to your grandparents.  
* Explain cryptocurrency to a high school student.  
* Explain cloud storage to a coworker with very little technical knowledge.  
* Explain inflation to a middle school student.

Although the topics are different, every prompt trains the exact same communication behavior.

This allows users to choose the topic they find most interesting without changing what they are actually practicing.

The training objective remains constant.

The communication context changes.

If users are not interested in any of the initial four prompts, they may refresh the prompt options.

Refreshing prompts should generate four new communication contexts while keeping the same:

* Core Skill  
* Core Skill Subskill  
* Exercise  
* Training objective

The refresh feature exists to increase engagement without changing the purpose of the workout.

---

### **Step 4: Exercise Configuration**

After a prompt has been selected, Cognify configures the exercise.

Configuration determines how the user will complete the rep without changing what they are training.

Configuration may include elements such as:

* Communication context  
* Speaking scenario  
* Time pressure  
* Exercise-specific constraints

These variables should be intentionally varied over time to improve communication transfer and maintain engagement.

For example, a user may practice the same Core Skill Subskill through:

* Explaining  
* Teaching  
* Recommending  
* Defending a position  
* Summarizing

Likewise, Cognify may vary the level of time pressure depending on the desired training outcome.

These adjustments should increase the breadth of communication experience without changing the underlying learning objective.

The skill remains constant.

The environment evolves.

---

### **Content Memory**

The Content Selection System should maintain awareness of previous training experiences.

Examples include:

* Recently completed exercises  
* Recently completed prompts  
* Recently skipped prompts  
* Recently used communication contexts  
* Recently used speaking scenarios

This information allows Cognify to reduce unnecessary repetition while maintaining meaningful variety.

The objective is for every Daily Workout to feel familiar enough to reinforce learning, yet different enough to remain engaging.

---

### **Success Criteria**

A successful Daily Workout Content Selection System should:

* Select content that directly supports the chosen training objective.  
* Expose users to broad content coverage during the Assessment Phase.  
* Become increasingly personalized over time.  
* Minimize unnecessary repetition.  
* Maintain intentional variety across workouts.  
* Allow users to choose topics without changing the communication behavior being trained.  
* Make every Daily Workout feel thoughtfully designed rather than randomly generated.

The user should never feel like Cognify is pulling exercises from a library.

They should feel like every workout was built specifically for them.

## **8.5.4 Lab Content Selection**

The Lab Content Selection System follows the same philosophy as Daily Workout but serves a different purpose.

Unlike Daily Workout, The Lab does not decide **what communication application** the user should practice.

The user makes that decision.

Once the application has been selected, the Content Selection System determines the most valuable content within that application.

For every Lab session, the Content Selection System determines:

* Which Application Skill Subskill should be trained  
* Which exercise best develops that subskill  
* Which four prompts should be presented  
* Which communication contexts should be used  
* Which speaking scenario should be presented  
* Which coaching focus should be emphasized  
* Which exercise parameters should be configured

As users spend more time within a communication application, content selection should become increasingly personalized.

For example, within Storytelling, Cognify may determine that a user consistently struggles with Narrative Arc.

Future Storytelling sessions may intentionally prioritize exercises that strengthen Narrative Arc while still exposing the user to different communication contexts, speaking scenarios, and prompt topics.

The objective is to continuously improve mastery within the selected communication application while keeping each session engaging and varied.

---

## **8.5.5 Build a Rep Content Selection**

Build a Rep also follows the same Content Selection philosophy, but instead of generating a workout, it generates a preparation experience.

The user provides the communication event.

The Content Selection System determines how that preparation experience should be constructed.

For every Build a Rep session, the Content Selection System determines:

* Which Preparation Plan should be generated  
* Which practice mode should be recommended  
* Which Critical Moments should be created  
* Which communication framework should be used  
* Which Coach’s Focus should be emphasized  
* Which event-specific coaching should be delivered  
* Which exercise parameters should be configured

When additional context is provided, such as:

* Job descriptions  
* Resumes  
* Presentation decks  
* Meeting agendas  
* Notes  
* Supporting documents

the Content Selection System should use that information to personalize every part of the preparation experience.

Each Build a Rep session should feel intentionally designed for that specific communication event rather than generated from a generic template.

---

# **8.5.6 Shared Content Selection Principles**

Although Daily Workout, The Lab, and Build a Rep generate different experiences, they should all follow the same content selection principles.

---

### **Every Piece of Content Should Have a Purpose**

Content should never be selected randomly.

Every exercise, prompt, communication context, speaking scenario, and constraint should exist because it reinforces a specific communication behavior.

Users should never feel like Cognify is pulling random prompts from a library.

Every content decision should contribute to long-term communication development.

---

### **Variety Should Be Intentional**

Variety exists to improve learning, not simply to make workouts feel different.

The Content Selection System should intentionally vary:

* Exercises  
* Prompt topics  
* Communication contexts  
* Speaking scenarios  
* Time pressure  
* Exercise constraints

while keeping the underlying communication objective constant.

Intentional variety encourages users to apply the same communication behaviors across many different situations, leading to stronger transfer into real-world communication.

---

### **Reduce Unnecessary Repetition**

The Content Selection System should maintain awareness of previous user experiences.

It should minimize unnecessary repetition by considering:

* Recently completed exercises  
* Recently completed prompts  
* Recently skipped prompts  
* Recently used communication contexts  
* Recently used speaking scenarios

Repetition should occur because it creates additional learning value—not because the system lacks new content.

---

### **Personalization Should Increase Over Time**

The longer someone uses Cognify, the more personalized content selection should become.

Early in the user’s journey, the system prioritizes broad coverage.

As the Communication Profile matures, content selection should increasingly reflect:

* Individual strengths  
* Individual weaknesses  
* Coaching History  
* Improvement Trends  
* Previous training experiences

Every rep should improve the quality of future content selection.

---

# **8.5.7 Success Criteria**

The Content Selection System is successful if users consistently feel that every communication experience was built specifically for them.

A successful Content Selection System should:

* Deliver content that directly supports the intended communication behavior.  
* Prioritize broad coverage during the Assessment Phase.  
* Become increasingly personalized over time.  
* Balance variety with intentional repetition.  
* Keep training engaging without sacrificing consistency.  
* Allow users to choose topics without changing the learning objective.  
* Continuously improve the quality of every communication experience.

The ideal experience is simple:

**Users should never wonder why they received a particular exercise or prompt. They should simply trust that every piece of content was intentionally selected to make them a better communicator.**

# 8.6 Adaptive Coaching

# **8.6 Adaptive Coaching**

Adaptive Coaching defines how Cognify helps users improve after every rep.

While the Adaptive Learning System determines **what** users should train and the Content Selection System determines **how** they train it, Adaptive Coaching determines **how users improve.**

Its purpose is not simply to evaluate communication.

Its purpose is to create lasting communication behavior change.

Every coaching point should help users perform better on their very next attempt while contributing to long-term communication improvement.

Adaptive Coaching is where Cognify becomes more than an AI evaluator—it becomes a communication coach.

---

# **8.6.1 Coaching Philosophy**

Traditional communication feedback focuses on what users did wrong.

Adaptive Coaching focuses on what users should do differently.

This distinction is fundamental to Cognify.

The goal of coaching is not to explain what happened.

The goal is to change what happens on the next rep.

Rather than overwhelming users with multiple suggestions, Cognify identifies the single highest-value behavior that will improve the objective of the current workout and helps the user immediately implement it.

Over time, these individual behavior changes compound into lasting communication improvement.

---

# **8.6.2 Behavioral Coaching**

Adaptive Coaching should coach behaviors, not scores.

Scores measure performance.

Behaviors explain why that performance occurred.

Every coaching point should answer three simple questions:

**What behavior held the user back?**

Identify the single communication behavior that created the greatest opportunity for improvement.

**Why does that behavior matter?**

Help the user understand why improving this behavior will strengthen their communication.

**What should the user do differently?**

Provide one clear behavioral action the user can immediately apply during their Retry.

Users should never finish a rep wondering how to improve.

They should always know exactly what behavior to change next.

---

# **8.6.3 Focused & Actionable Coaching**

Every rep should contain **one coaching point.**

By focusing on one behavior at a time, Cognify keeps coaching clear, actionable, and easy to implement.

The coaching point should always reinforce the objective of the current workout.

If today’s Daily Workout is focused on Clarity, the coaching point should come from the Clarity behavior being trained—not from another Core Skill.

The objective is not to identify every opportunity for improvement.

The objective is to identify the **highest-leverage behavior** that will create the greatest improvement on the next rep.

---

# **8.6.4 Coaching Memory**

Communication improvement happens over many reps, not just one.

Adaptive Coaching should remember previous coaching and build upon it over time.

If the same behavior continues appearing, Cognify should recognize that pattern rather than repeating the same coaching as if it has never seen it before.

Likewise, when a user successfully improves a previously coached behavior, Cognify should acknowledge that progress before shifting focus to the next highest-value opportunity.

This creates the feeling of working with a coach who understands your communication journey rather than an AI that starts over every session.

---

# **8.6.5 Retry**

Retry is where coaching becomes learning.

Its purpose is not to earn a higher score.

Its purpose is to immediately apply the coaching point while the feedback is still fresh.

Every Retry should answer one question:

**Can the user successfully implement today’s coaching point?**

By immediately practicing one targeted behavior, users transform feedback into deliberate practice and gradually build stronger communication habits.

---

# **8.6.6 Success Criteria**

Adaptive Coaching is successful if users consistently leave every rep knowing exactly what to improve next.

A successful coaching system should:

* Coach behaviors rather than scores.  
* Focus on one coaching point at a time.  
* Explain why the behavior matters.  
* Provide one clear action for the Retry.  
* Reinforce the objective of the current workout.  
* Remember previous coaching.  
* Recognize meaningful improvement over time.  
* Build better communication habits through deliberate practice.

The ideal coaching experience is simple:

**Users should leave every rep with one clear behavior to improve, understand why it matters, and immediately practice it through the Retry.**

# 8.7 Wrap Up

# **8.7 Intelligence Design Principles**

The systems described throughout this section represent Cognify’s long-term intelligence architecture.

While individual capabilities may initially be implemented using simpler heuristics, every future enhancement should follow the same design principles.

These principles ensure Cognify remains focused on one objective: helping users become better communicators through intelligent, personalized practice.

---

## **8.7.1 Intelligence Should Reduce Decisions**

The purpose of Cognify’s intelligence is not to create more choices.

Its purpose is to remove unnecessary decisions.

Users should not have to decide:

* What to practice  
* Which exercise to complete  
* Which prompt will best improve their communication  
* Which feedback matters most

Instead, Cognify should make these decisions intelligently so users can focus entirely on practicing.

The platform should function like a great coach—guiding the user without requiring them to constantly decide what comes next.

---

## **8.7.2 Complexity Should Live Behind the Scenes**

Cognify’s intelligence should remain largely invisible to the user.

While the platform continuously analyzes communication, personalizes training, and adapts coaching behind the scenes, the user experience should remain simple and intuitive.

Users should primarily interact with:

* Their Communication Snapshot  
* Daily Workout  
* The Lab  
* Build a Rep  
* Coaching

The complexity of the underlying intelligence should never become complexity in the user experience.

As Cognify becomes more intelligent, it should feel simpler—not more complicated.

---

## **8.7.3 Personalization Should Increase Over Time**

Every new user begins with a limited Communication Profile.

As more reps are completed, Cognify develops a deeper understanding of how that individual communicates.

This growing understanding should improve every intelligent system across the platform.

Over time, users should feel that:

* Workouts become more relevant.  
* Content becomes more personalized.  
* Coaching becomes more effective.  
* Communication improvement becomes more targeted.

The longer someone uses Cognify, the more valuable the platform should become.

---

## **8.7.4 Every Rep Should Make Cognify Smarter**

Every completed rep creates value beyond that individual training session.

Each rep strengthens the user’s Communication Profile while improving Cognify’s understanding of how they communicate.

No rep should exist in isolation.

Every communication experience contributes to more intelligent training, more personalized coaching, and better long-term communication development.

---

## **8.7.5 Behavior Change Over Score Improvement**

Scores are an important measurement tool.

They are not the objective.

The objective of Cognify is to create lasting communication behavior change.

Adaptive Learning, Content Selection, Adaptive Coaching, and Retry should all work together to help users build stronger communication habits over time.

Scores simply provide evidence that those behaviors are improving.

---

## **8.7.6 Trust the Coach**

Cognify is designed around the belief that users should spend their time practicing—not deciding how to practice.

The platform should intelligently determine what users need to work on and guide them through a structured learning experience.

Users place their trust in Cognify to:

* Identify their greatest opportunities for improvement.  
* Select the highest-value training experiences.  
* Deliver focused coaching.  
* Guide long-term communication development.

By reducing unnecessary decisions and delivering personalized guidance, Cognify allows users to focus entirely on becoming better communicators.

---

## **8.7.7 Success Criteria**

The Intelligence Architecture is successful if users consistently feel that Cognify understands how they communicate and knows exactly how to help them improve.

Every intelligent system should work together to create an experience that feels:

* Personalized  
* Intentional  
* Consistent  
* Simple  
* Effective

The user should never feel overwhelmed by the intelligence behind Cognify.

Instead, they should simply feel that every workout, every coaching point, and every communication experience was thoughtfully designed to help them become a better communicator.

# Section 9: Content Architecture 

# **9\. Content Architecture**

## **9.1 Purpose**

The purpose of this section is to define how Cognify’s training content is organized, generated, and expanded.

While the Personalization System determines **what** users should train, the Content Architecture defines **what training content exists** and **how that content is delivered to users.**

Cognify’s content is intentionally built in layers.

Rather than relying on AI to create entire training experiences from scratch, Cognify combines handcrafted Exercise Frameworks with AI-generated prompts.

This approach ensures every exercise is grounded in deliberate practice while still providing enough variety to keep training fresh and engaging.

The objective is to create a content system that is:

* Consistent in training quality.  
* Highly scalable.  
* Easy to expand.  
* Diverse enough to prevent repetition.  
* Simple for users while remaining powerful behind the scenes.

Exercises define the communication objective.

Prompts simply provide a natural way for users to begin speaking.

---

# **9.2 Exercise Architecture**

Exercise Frameworks are the foundation of Cognify’s content system.

Every exercise within Daily Workout, The Lab, and Build a Rep is built from a predefined Exercise Framework designed by the Cognify team.

Exercise Frameworks are **not** generated by AI.

They are intentionally created to train specific communication skills and expose specific communication behaviors.

Each Exercise Framework should clearly define:

* The communication objective.  
* The Core Skill or Communication Application being trained.  
* The Hidden Behavior(s) being targeted.  
* The type of communication required from the user.  
* The coaching philosophy for the exercise.  
* The scoring lens used to evaluate performance.  
* The Retry objective.  
* The prompt generation rules.

By standardizing Exercise Frameworks, Cognify ensures every training experience follows proven communication principles while maintaining consistent coaching and scoring across the platform.

---

## **9.2.1 Exercise Hierarchy**

Every piece of content inside Cognify follows the same hierarchy.

**Daily Workout**

Core Skill

↓

Hidden Behavior

↓

Exercise Framework

↓

Prompt

---

**The Lab**

Communication Application

↓

Application Subskill

↓

Exercise Framework

↓

Prompt

---

**Build a Rep**

Communication Event

↓

Scenario / Critical Moment

↓

Exercise Framework (when applicable)

↓

Prompt or Simulation

This hierarchy allows Cognify to maintain a consistent content architecture across every training mode while allowing each mode to deliver a unique learning experience.

---

## **9.2.2 Exercise Reusability**

Exercise Frameworks are designed to be reusable.

The learning objective of an exercise should remain consistent over time, while the prompts generated from that framework continuously change.

For example, an Exercise Framework designed to improve Audience Awareness may generate hundreds or thousands of different prompts over its lifetime, all reinforcing the same underlying communication behavior.

This allows users to repeatedly train the same communication skill without feeling like they are repeating the same exercise.

The framework remains constant.

The prompt creates novelty.

As the Cognify content library grows, new Exercise Frameworks can be added without changing the overall architecture, allowing the platform to continuously expand while maintaining a consistent user experience.

# **9.3 Prompt Architecture**

While Exercise Frameworks define the communication objective, prompts provide the context in which users practice that objective.

Prompts should never change **what** the user is training.

They should only change **what the user is talking about.**

This distinction is fundamental to Cognify’s content system.

Regardless of which prompt a user selects, every prompt generated from the same Exercise Framework should train the same communication skill, target the same Hidden Behavior(s), reinforce the same coaching philosophy, and use the same scoring criteria.

The topic changes.

The training objective does not.

This allows Cognify to provide nearly unlimited variety while maintaining consistent training quality.

---

# **9.3.1 Prompt Generation**

Prompts are generated from predefined Exercise Frameworks.

Rather than writing every prompt manually, Cognify uses AI to generate prompts that follow the rules established by each Exercise Framework.

Every generated prompt should preserve the learning objective while introducing a new topic, audience, or scenario.

Each prompt should feel like a natural conversation someone would actually enjoy practicing.

The goal is to remove the friction between opening an exercise and beginning to speak.

Users should spend as little time as possible deciding what to respond to and as much time as possible practicing communication.

---

# **9.3.2 Prompt Quality Standards**

Great prompts make users want to speak.

A prompt should never feel academic, robotic, or unnecessarily complicated.

Instead, prompts should feel natural, conversational, and grounded in situations users could realistically imagine themselves discussing.

Every prompt should be:

* Easy to understand immediately.  
* Interesting enough to encourage speaking.  
* Relevant to everyday communication.  
* Appropriate for spoken responses.  
* Focused on one communication objective.  
* Achievable without research or specialized knowledge.  
* Designed to transfer into real-world communication.

The challenge should come from **how the user communicates**, not from understanding the prompt itself.

Exercises create the challenge.

Prompts simply create an engaging reason to begin speaking.

---

# **9.4 Prompt Selection**

For every exercise, Cognify presents users with **four prompt options**.

Each prompt trains the same communication objective while varying the topic, audience, context, or scenario.

This allows users to make one creative decision without influencing the quality of their training.

Users are not choosing what to train.

Cognify has already made that decision.

Users are simply choosing which conversation they would most enjoy having.

This balance provides users with a sense of autonomy while ensuring every option supports the same learning objective.

---

# **9.4.1 Prompt Diversity**

The four prompts shown together should feel meaningfully different from one another.

Rather than presenting four similar prompts, Cognify should intentionally vary the types of conversations being offered.

Variation may include:

* Personal experiences.  
* Workplace situations.  
* Everyday life.  
* Hypothetical scenarios.  
* Current topics.  
* Funny or lighthearted situations.  
* Challenging or reflective conversations.

Likewise, prompts should naturally vary in audience, setting, and communication context.

The objective is to maximize the likelihood that users immediately find a prompt they are excited to respond to.

Prompt diversity should increase engagement without changing the underlying communication objective.

---

# **9.4.2 Prompt Refresh**

If a user does not find a prompt they want to answer, they may refresh the prompt list.

Refreshing replaces **all four prompts** with four completely new options generated from the same Exercise Framework.

Previously displayed prompts should not reappear during the current training session.

This prevents unnecessary repetition and encourages genuine variety while users search for a topic they are excited to discuss.

When a new training session begins, previously skipped prompts may become available again as part of the normal prompt pool.

The purpose of Prompt Refresh is not to change the training objective.

Its purpose is to help users quickly find a conversation they are excited to have while preserving the integrity of the exercise

# Section 10: Progression System

# **10\. Progression System**

## **10.1 Purpose**

The Progression System exists to make communication improvement visible, rewarding, and motivating over the long term.

While the Intelligence Architecture determines how users improve, the Progression System determines how that improvement is measured, displayed, and reinforced throughout the Cognify experience.

Every progression mechanic should encourage users to return, complete meaningful communication practice, and build lasting communication habits.

Progression should never reward activity alone. Instead, it should reward meaningful communication development through consistent practice, implementation of coaching, and long-term growth.

The Progression System consists of multiple layers, each serving a distinct purpose in measuring communication ability, tracking development, encouraging consistency, and motivating long-term engagement.

Every progression system within Cognify has a single, clearly defined purpose, ensuring users always understand what each metric represents.

---

## **10.2 Progression Philosophy**

The Progression System is designed around several core principles that guide every progression mechanic throughout Cognify.

### **Communication Improvement Comes First**

Progression should reinforce communication improvement rather than distract from it.

Users should feel motivated to become better communicators—not simply to collect rewards.

---

### **Meaningful Communication Development Is Rewarded**

Progression should be influenced by behaviors that contribute to long-term communication development.

Examples include:

* Completing Daily Workouts.  
* Completing Skill Lab sessions.  
* Completing Build a Rep sessions.  
* Successfully implementing coaching during Retries.  
* Improving Communication Scores.  
* Maintaining consistent practice over time.

Activities that do not meaningfully contribute to communication growth should not significantly advance progression.

---

### **Early Momentum, Long-Term Mastery**

Progression should feel rewarding from the very beginning while remaining meaningful over months and years of use.

Early ranks should be earned relatively quickly to build confidence and establish momentum.

As users progress, advancement should become increasingly difficult, reflecting greater mastery, consistency, and long-term commitment.

Progression is intentionally non-linear.

Higher ranks should require substantially more long-term development than earlier ranks.

---

### **Progression Never Moves Backward**

Once a rank has been earned, it is permanently retained.

Communication ability may improve over time, but previously earned progression should never be removed.

Ranks represent long-term communication development through Cognify rather than a user’s current communication ability.

---

## **10.3 Communication Score**

The Communication Score represents a user’s overall communication ability.

It provides a single, easy-to-understand measure that reflects communication performance across Cognify.

This is the primary score users should reference when evaluating their overall communication development.

The Communication Score continuously reflects a user’s demonstrated communication ability as they train within Cognify.

Its purpose is to answer one question:

**“How strong of a communicator am I today?”**

---

## **10.3.1 Fundamental Scores**

The Communication Score is supported by six Fundamental Scores representing the Core Skills trained within Daily Workout.

These include:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

Fundamental Scores help users understand which communication foundations are strongest and which require additional development.

Their purpose is to answer:

**“Which communication fundamentals am I strongest and weakest in?”**

---

## **10.3.2 Application Scores**

In addition to the Communication Score, Skill Lab maintains individual scores for each Communication Application.

Examples include:

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

Application Scores measure communication ability within specific real-world communication scenarios.

Unlike Fundamental Scores, which evaluate broad communication foundations, Application Scores evaluate how effectively users apply those foundations in practical situations.

Their purpose is to answer:

**“Which communication situations am I strongest and weakest in?”**

# **10.4 Hidden Subskill Scores**

While users see their overall Communication Score, Fundamental Scores, and Application Scores, Cognify maintains a deeper layer of internal scoring that powers its intelligence.

Each Core Skill and Communication Application is broken down into multiple Subskills that measure specific communication behaviors.

Examples include:

**Storytelling**

* Hook Creation  
* Story Structure  
* Vivid Details  
* Emotional Connection  
* Clear Takeaway

**Clarity**

* Concreteness  
* Audience Awareness  
* Ambiguity Reduction  
* Word Choice  
* Idea Density

These Subskill Scores are not displayed to users.

Instead, they continuously inform Cognify’s Intelligence Architecture, including:

* Adaptive Training  
* Exercise Selection  
* Prompt Selection  
* Adaptive Coaching  
* Retry Generation  
* Communication Insights  
* Longitudinal Learning

Keeping this layer behind the scenes allows Cognify to deliver highly personalized coaching without overwhelming users with unnecessary complexity.

---

# **10.5 Rank System**

The Rank System represents a user’s long-term progression through Cognify.

Unlike Communication Scores, which measure current communication ability, Rank reflects a user’s continued commitment to practicing, improving, and implementing communication skills over time.

Rank should always move forward.

Once a rank has been earned, it is permanently retained and is never reduced due to inactivity or fluctuations in Communication Score.

Its purpose is to answer one question:

**“How far have I progressed through Cognify?”**

---

## **10.5.1 Rank Structure**

Cognify uses a single global Rank System across the entire platform.

Users do not earn separate ranks for Daily Workout, Skill Lab, or Build a Rep.

Every meaningful training experience contributes toward one overall Cognify Rank.

The initial rank structure consists of:

**Bronze**

* Bronze I  
* Bronze II  
* Bronze III  
* Bronze IV

**Silver**

* Silver I  
* Silver II  
* Silver III  
* Silver IV

**Gold**

* Gold I  
* Gold II  
* Gold III  
* Gold IV

**Platinum**

* Platinum I  
* Platinum II  
* Platinum III  
* Platinum IV

**Diamond**

* Diamond I  
* Diamond II  
* Diamond III  
* Diamond IV

**Elite**

* Elite I  
* Elite II  
* Elite III  
* Elite IV

**Master**

* Master I  
* Master II  
* Master III  
* Master IV

**Grandmaster**

* Grandmaster I  
* Grandmaster II  
* Grandmaster III  
* Grandmaster IV

Each rank is represented by a unique visual badge displayed throughout the product.

The badge serves as the user’s primary visual representation of long-term progression and should become one of the most recognizable elements of the Cognify experience.

---

## **10.5.2 Rank Progress**

Progress toward the next rank should always be visible.

Rather than displaying experience points or numerical progression values, Cognify presents a simple progress bar beneath the user’s current rank.

Every meaningful training activity contributes toward filling this bar.

After completing a training session, users immediately see their updated:

* Communication Score  
* Relevant Fundamental or Application Score improvements  
* Current Rank  
* Updated Rank Progress

This immediate feedback reinforces that every session contributes toward long-term development while keeping progression simple and intuitive.

---

## **10.5.3 Rank Progression**

Rank progression should reward meaningful communication development rather than activity alone.

Progress is influenced by multiple signals across the platform, including:

* Daily Workout completion  
* Skill Lab completion  
* Build a Rep completion  
* Successful implementation during Retries  
* Communication Score improvement  
* Consistent training habits  
* Meaningful communication reps completed

Each activity contributes differently based on its role within Cognify.

Daily Workout serves as the primary driver of progression because it represents the platform’s core training experience.

Skill Lab and Build a Rep also contribute to progression but carry different relative weights.

Successfully implementing coaching during a Retry should receive additional progression because it demonstrates behavioral improvement rather than simple participation.

The exact weighting of these activities should remain configurable so the progression system can be refined over time without changing the underlying architecture.

---

## **10.5.4 Progression Curve**

Rank progression is intentionally non-linear.

Early ranks should be earned relatively quickly to build confidence, establish momentum, and help users experience meaningful progress soon after joining Cognify.

As users advance, progression should gradually slow.

Each successive rank should require greater long-term commitment, consistent practice, and demonstrated communication growth than the one before it.

Higher ranks should feel increasingly valuable because they represent sustained communication development rather than short-term activity.

The progression system should be calibrated so users cannot rapidly advance through multiple ranks in a short period of time.

Long-term consistency, implementation of coaching, and continuous improvement should remain the primary drivers of advancement.

# **10.6 Achievements**

Achievements celebrate meaningful milestones throughout a user’s communication journey.

Unlike Rank, which represents long-term progression, Achievements recognize specific accomplishments and reinforce positive behaviors.

Achievements should feel rewarding, memorable, and encourage continued engagement without becoming the primary focus of the product.

Examples include:

* 🏆 First Daily Workout  
* 🏆 100 Communication Reps Completed  
* 🏆 30-Day Streak  
* 🏆 First Skill Lab Completed  
* 🏆 First Build a Rep Completed  
* 🏆 1,000 Total Communication Reps

As Cognify evolves, additional achievements can be introduced to celebrate new milestones and encourage long-term engagement.

---

# **10.7 Streak System**

The Streak System encourages users to build consistent communication habits while remaining flexible enough to fit different schedules.

Rather than requiring users to practice every day, Cognify allows users to choose the days they want to commit to each week.

Examples include:

* Monday–Friday  
* Monday, Wednesday, Friday  
* Tuesday and Thursday  
* Every day

A streak is maintained by completing a meaningful training session on each committed day.

Missing a day that is not part of the user’s selected schedule does not affect their streak.

This creates a progression system that rewards consistency without forcing unnecessary daily engagement.

---

## **10.7.1 Streak Freezes**

To protect long-term habits from occasional life events, Cognify includes Streak Freezes.

A Streak Freeze prevents a committed training day from breaking a user’s streak.

Streak Freezes should be limited and intentionally valuable.

Their purpose is to preserve motivation during occasional missed sessions rather than eliminate accountability.

---

# **10.8 Workout Completion Experience**

Every completed training session should end with a clear sense of progress.

Regardless of the training mode, users should immediately understand what they accomplished and how they improved.

The completion experience should reinforce that every meaningful training session contributes toward long-term communication development.

After completing a session, users should see:

* Updated Communication Score (if applicable)  
* Updated Fundamental or Application Scores (if applicable)  
* Current Rank  
* Updated Rank Progress  
* Current Streak  
* Newly earned Achievements (when applicable)

The completion experience should feel rewarding without overwhelming users with unnecessary information.

Its purpose is to encourage users to return for their next training session.

---

## **10.8.1 Celebration & Feedback**

Progress should be celebrated in a way that feels motivating without becoming distracting.

Examples include:

* Rank promotion celebrations.  
* Achievement unlock animations.  
* Score improvement highlights.  
* Positive reinforcement after successful Retry implementation.

Celebrations should reinforce meaningful communication improvement rather than simply reward activity.

The objective is to make progress feel visible while keeping the focus on becoming a better communicator.

# **10.9 Leaderboards**

Leaderboards provide users with meaningful comparisons while encouraging continued improvement.

Their purpose is not simply to rank users, but to create healthy competition that reinforces consistent communication development.

By default, Leaderboards should prioritize **weekly improvement**, giving every user an opportunity to compete regardless of their current Communication Score.

The default leaderboard should rank users based on their improvement over the current week.

Example:

![][image2]

This rewards communication growth rather than natural ability.

In addition to Weekly Improvement, users should be able to filter Leaderboards by Overall Communication Score to view the highest-performing communicators across the platform.

Leaderboards should encourage motivation without discouraging newer users.

---

# **10.10 Weekly Challenges**

Weekly Challenges provide users with short-term goals that encourage consistent engagement.

Unlike long-term Rank progression, Weekly Challenges reset regularly, giving users new opportunities to participate and improve.

Challenges should focus on meaningful communication behaviors rather than arbitrary activity.

Examples include:

* Complete three Daily Workouts.  
* Complete five Skill Lab sessions.  
* Successfully implement coaching during ten Retries.  
* Complete twenty communication reps.  
* Maintain your committed training schedule for the week.

Weekly Challenges should complement the user’s existing training routine rather than encourage unnecessary or repetitive activity.

---

# **10.11 Team Challenges**

Team Challenges allow users to collaborate toward shared communication goals.

Rather than competing only as individuals, users can participate in challenges with friends, coworkers, classmates, or other groups.

Examples include:

* Complete 250 communication reps as a team.  
* Finish 50 Daily Workouts together.  
* Maintain a team streak throughout the week.  
* Improve your team’s average Communication Score.

Team Challenges should reinforce accountability, consistency, and shared motivation while strengthening the social experience within Cognify.

The objective is to make communication improvement feel collaborative as well as individual.

---

# **10.12 Success Criteria**

The Progression System is successful if users consistently feel that their communication development is visible, rewarding, and worth returning to each day.

Every progression mechanic should reinforce meaningful communication improvement rather than distract from it.

A successful Progression System should:

* Clearly communicate communication ability.  
* Make long-term progress visible.  
* Reward implementation, not just participation.  
* Encourage consistent training habits.  
* Celebrate meaningful milestones.  
* Promote healthy competition.  
* Support long-term engagement without overwhelming users.

Every progression system within Cognify should have a single, clearly defined purpose.

* **Communication Score** measures current communication ability.  
* **Fundamental Scores** identify strengths and weaknesses across the Core Skills.  
* **Application Scores** measure communication ability within real-world scenarios.  
* **Hidden Subskill Scores** power Cognify’s Intelligence Architecture.  
* **Rank** represents long-term communication development.  
* **Achievements** celebrate meaningful milestones.  
* **Streaks** reinforce consistency.  
* **Leaderboards** encourage healthy competition and improvement.

Together, these systems create a progression experience that motivates users to continually practice, improve, and return to Cognify over the long term.

# Section 11: Product Standards

# **11\. Product Standards**

## **11.1 Purpose**

This chapter defines the standards that every feature, exercise, prompt, coaching interaction, and AI decision within Cognify should meet.

These standards represent the practical application of the principles established in the Cognify Research Foundation. They translate research into consistent product decisions that guide how every part of the platform should be designed, evaluated, and improved.

Rather than describing how individual systems function, this chapter establishes the quality standards that every future addition to Cognify should satisfy.

As Cognify evolves, every new feature should be evaluated against these standards to ensure the product remains consistent, evidence-informed, and aligned with Cognify’s mission of helping people become better communicators.

The objective is not simply to build more features.

The objective is to ensure every feature measurably improves communication.

---

# **11.2 Exercise Design Standards**

Exercises are the foundation of communication improvement within Cognify.

Every Exercise Framework should be intentionally designed around a single communication objective and produce measurable behavioral improvement through deliberate practice, feedback, and implementation.

Exercises should never exist simply to create content. Every exercise should have a clearly defined purpose within the communication curriculum and contribute to developing a specific communication behavior that transfers to real-world situations.

Every Exercise Framework should:

* Train one primary communication objective.  
* Target one or more clearly defined communication behaviors.  
* Create opportunities for meaningful coaching.  
* Support immediate Retry implementation.  
* Produce measurable communication improvement over time.  
* Transfer directly to real-world communication.  
* Be reusable across a wide variety of prompts and communication scenarios.  
* Scale naturally as the content library expands.

Exercises should challenge how users communicate rather than simply testing what they know.

Every exercise should have a clear reason for existing within Cognify’s curriculum.

If an exercise cannot produce measurable communication improvement, it should not be included in the platform.

---

## **11.3 Prompt Design Standards**

Prompts exist to remove friction between selecting an exercise and beginning to speak.

They should support the Exercise Framework without becoming the focus of the training experience.

A great prompt should make users immediately think:

**“I know exactly what I’d say.”**

Every prompt should:

* Be immediately understandable.  
* Feel natural and conversational.  
* Encourage spoken rather than written communication.  
* Be engaging enough to reduce hesitation.  
* Reinforce the communication objective of the Exercise Framework.  
* Require minimal interpretation before speaking.  
* Minimize unnecessary cognitive load.  
* Transfer naturally to real-world conversations.

Prompts should introduce variety without changing the underlying learning objective.

The communication challenge should come from how the user communicates, not from understanding the prompt itself.

The ideal prompt encourages users to begin speaking within seconds of seeing it.

# **11.4 Coaching Standards**

Coaching is the foundation of behavioral improvement within Cognify.

The objective of coaching is not simply to identify mistakes. It is to help users understand the highest-impact change they can make and immediately apply it.

Every coaching interaction should increase the likelihood that the user’s next communication attempt is better than the previous one.

Every coaching response should:

* Identify the highest-leverage opportunity for improvement.  
* Focus on one primary coaching objective at a time.  
* Be specific rather than generic.  
* Be actionable and immediately implementable.  
* Explain what should change and why it matters.  
* Prepare the user for a successful Retry.  
* Reinforce behaviors that transfer to real-world communication.

Coaching should prioritize behavior change over information delivery.

Users should leave every coaching interaction knowing exactly what to improve during their next attempt.

---

## **11.4.1 Retry Standards**

The Retry is the most important part of Cognify’s learning experience.

Every Retry should create an immediate opportunity to implement coaching while the previous attempt is still fresh.

Retries should:

* Focus on implementing the primary coaching point.  
* Encourage users to apply feedback immediately.  
* Reinforce behavioral improvement rather than repetition.  
* Build confidence through successful implementation.  
* Demonstrate measurable improvement whenever possible.

A Retry should never feel like repeating the same exercise.

It should feel like an immediate opportunity to communicate more effectively using what was just learned.

---

# **11.5 Scoring Standards**

Scoring exists to measure communication ability in a way that is consistent, meaningful, and actionable.

Scores should help users understand their communication development while providing the intelligence layer with accurate information for personalization and coaching.

Every scoring decision should be:

* Behavior-based.  
* Consistent across similar performances.  
* Explainable.  
* Sensitive enough to detect meaningful improvement.  
* Stable enough to avoid unnecessary fluctuations.  
* Aligned with the communication objective being evaluated.

Scores should reflect demonstrated communication ability rather than effort alone.

---

## **11.5.1 Scoring Philosophy**

Every score within Cognify should have a single, clearly defined purpose.

* **Communication Score** measures overall communication ability.  
* **Fundamental Scores** measure the six Core Skills.  
* **Application Scores** measure communication ability within Skill Lab.  
* **Hidden Subskill Scores** power Cognify’s Intelligence Architecture.

No score should exist unless it helps either the user or the platform make better decisions.

Scoring should simplify communication improvement rather than overwhelm users with unnecessary metrics.

The Intelligence Layer may evaluate many communication behaviors behind the scenes, but users should only see the information that meaningfully helps them improve.

# **11.6 Intelligence Standards**

Artificial intelligence should enhance the learning experience without becoming the focus of the product.

Users should experience the benefits of intelligent personalization, coaching, and adaptation without needing to understand the complexity behind it.

The Intelligence Layer exists to make better decisions on behalf of the user—not to increase complexity or reduce user control.

Every AI decision should contribute to a more effective learning experience.

The Intelligence Layer should:

* Continuously learn from user performance.  
* Adapt training based on demonstrated communication behaviors.  
* Deliver increasingly personalized coaching over time.  
* Make intelligent decisions using the user’s Communication Profile.  
* Remain consistent and predictable in its recommendations.  
* Operate behind the scenes whenever possible.

Intelligence should simplify the user’s experience, not complicate it.

The most intelligent system is often the one users notice the least.

---

## **11.7 Personalization Standards**

Personalization exists to help every user spend more time practicing what will improve their communication the most.

Rather than allowing users to manually decide every aspect of their training, Cognify should intelligently guide users toward the highest-value learning opportunities while still preserving a sense of autonomy.

Every personalization decision should:

* Be based on demonstrated communication performance.  
* Prioritize behaviors with the greatest opportunity for improvement.  
* Reinforce strengths alongside weaknesses.  
* Adapt as users develop new communication abilities.  
* Avoid unnecessary repetition.  
* Balance challenge with confidence-building.  
* Support long-term communication development rather than short-term performance.

Personalization should feel natural rather than obvious.

Users should simply feel that Cognify consistently gives them the right workout at the right time.

---

## **11.8 Product Standard Evaluation**

Every new feature, Exercise Framework, prompt, coaching interaction, scoring model, or AI capability added to Cognify should be evaluated against the standards defined in this chapter before becoming part of the product.

Before introducing anything new, the following questions should be answered:

* Does it help users become better communicators?  
* Is it supported by the Cognify Research Foundation?  
* Does it reinforce deliberate practice rather than passive learning?  
* Does it create measurable communication improvement?  
* Does it integrate naturally with the existing learning experience?  
* Does it maintain simplicity for the user?  
* Does it improve the overall quality of Cognify?

If the answer to any of these questions is no, the feature should be redesigned or reconsidered before implementation.

---

## **11.9 Success Criteria**

This chapter is successful if it establishes a consistent definition of quality for every future product decision.

As Cognify evolves, these standards should become the benchmark against which every addition to the platform is evaluated.

A successful Product Standards framework should ensure that every feature:

* Improves real-world communication.  
* Aligns with established research and learning science.  
* Reinforces deliberate practice.  
* Supports measurable behavioral improvement.  
* Maintains a simple and intuitive user experience.  
* Contributes to the long-term consistency and quality of the platform.

The objective is not to maximize the number of features within Cognify.

The objective is to ensure every feature earns its place by making users better communicators.

# Appendix

# MVP Scope 

# **Appendix A. MVP Scope**

## **A.1 Purpose**

This appendix defines the scope of the initial public release of Cognify.

The objective of the MVP is not to build every feature envisioned for the platform. Its objective is to validate Cognify’s core learning architecture by creating a product that consistently improves users’ communication skills and encourages long-term engagement.

Features should only be included if they directly strengthen the core learning experience.

Any feature that does not meaningfully improve the MVP should be deferred to a future version of the product.

---

## **A.2 Included Training Modes**

The MVP includes the three core training modes that define the Cognify learning experience.

### **Daily Workout**

The primary communication training experience.

Includes:

* Personalized Daily Workouts  
* Core Skill training  
* Exercise Frameworks  
* AI coaching  
* Immediate Retry implementation  
* Adaptive exercise selection  
* Adaptive prompt selection  
* Progress tracking

---

### **Skill Lab**

Application-focused communication training.

Includes:

* Storytelling  
* Presenting  
* Teaching  
* Interviewing  
* Persuasion

Each application includes:

* Purpose-built Exercise Frameworks  
* AI coaching  
* Immediate Retries  
* Application scoring

---

### **Build a Rep**

Personalized communication practice for real-world situations.

Includes:

* Custom scenario creation  
* AI coaching  
* Immediate Retries  
* Personalized communication practice  
* Scenario-specific feedback

---

## **A.3 Intelligence Architecture**

The MVP includes the foundational Intelligence Layer that powers Cognify’s personalized learning experience.

This includes:

* Communication Profiles  
* Hidden Subskill tracking  
* Adaptive coaching  
* Adaptive exercise selection  
* Adaptive prompt selection  
* Retry generation  
* Personalized Communication Insights  
* Long-term user memory

The Intelligence Layer should remain invisible to users while continuously improving the quality of coaching and personalization.

---

## **A.4 Progression System**

The MVP includes the complete progression system defined in Section 10\.

This includes:

* Overall Communication Score  
* Fundamental Scores  
* Application Scores  
* Hidden Subskill Scores (AI only)  
* Cognify Rank  
* Rank Progress  
* Streaks  
* Achievements  
* Leaderboards  
* Weekly Challenges

Each progression system serves a unique purpose and should reinforce meaningful communication improvement without unnecessary complexity.

---

## **A.5 Core Learning Loop**

Every training experience within the MVP should reinforce the same learning loop:

1. Complete an Exercise.  
2. Receive targeted AI coaching.  
3. Immediately implement the coaching through a Retry.  
4. Receive updated feedback.  
5. Track progress over time.

This Retry Loop is the foundation of communication improvement within Cognify and should remain consistent across all training modes.

---

## **A.6 MVP Success Criteria**

The MVP is successful if users consistently return to train and demonstrate measurable communication improvement over time.

Success should be measured by users who:

* Complete Daily Workouts consistently.  
* Engage with Skill Lab and Build a Rep.  
* Implement coaching during Retries.  
* Improve their Communication Scores over time.  
* Develop sustainable communication habits.  
* Feel motivated to continue progressing through Cognify.

The MVP should prove that Cognify’s learning architecture creates meaningful, repeatable communication improvement.

---

## **A.7 Scope Guardrails**

To maintain focus, the MVP should prioritize depth over breadth.

The objective is to deliver an exceptional core learning experience rather than the largest possible feature set.

Any feature that does not directly strengthen the core learning loop should be considered out of scope for the MVP unless there is a compelling strategic reason to include it.

When evaluating new ideas, the guiding question should be:

**Does this make users better communicators, or is it simply another feature?**

If the answer is the latter, it belongs in a future version of Cognify.

# Future ideas

# **Appendix B. Future Ideas**

## **B.1 Purpose**

This appendix captures product ideas that may be explored in future versions of Cognify.

The ideas listed below are intentionally outside the scope of the MVP and should not be interpreted as committed roadmap items. Their inclusion simply ensures valuable concepts are documented for future evaluation.

Future ideas should only be pursued if they strengthen Cognify’s mission of helping users become better communicators while remaining consistent with the Product Standards defined in this document.

---

## **B.2 Product Ideas**

### **Training**

* Additional Skill Lab applications  
* Additional Build a Rep templates  
* Industry-specific communication tracks  
* Role-specific communication training  
* Advanced simulation environments

### **Intelligence**

* More advanced coach memory  
* Adaptive difficulty progression  
* Smarter exercise sequencing  
* Improved Communication Insights  
* AI-generated training content

### **Progression & Gamification**

* Monthly Challenges  
* Expanded achievement system  
* Additional Cognify Rank tiers  
* Seasonal competitions  
* Team-based progression

### **Collaboration**

* Team training  
* Organization workspaces  
* Enterprise dashboards  
* Manager coaching tools  
* Shared communication goals

### **Platform Expansion**

* Desktop application  
* Tablet optimization  
* Browser extension  
* Calendar integration  
* Meeting preparation integrations

### **Analytics**

* Advanced communication analytics  
* Long-term development reports  
* Organization benchmarking  
* Personalized improvement roadmaps

---

## **B.3 Future Development Philosophy**

Future features should not be added simply because they are technically possible.

Every new capability should strengthen the core learning experience, improve measurable communication outcomes, or increase long-term user engagement without adding unnecessary complexity.

The core learning architecture established in the MVP should remain the foundation upon which all future versions of Cognify are built.

# Terminology 

# **1\. Product Architecture Terminology**

## **Training Mode**

A **Training Mode** is one of the three primary ways users train within Cognify. Each mode serves a different purpose while using the same Cognify Training System.

---

## **Cognify Training System**

The **Cognify Training System** is the universal learning process used across every Training Mode. Every exercise follows the same learning loop: Coach’s Insight → First Rep → Coach Feedback → Retry → Improvement Review.

---

## **Daily Workout**

**Daily Workout** is Cognify’s primary training experience. It develops the six Core Skills through consistent deliberate practice.

---

## **Skill Lab**

**Skill Lab** is the application-based Training Mode where users practice applying communication skills in realistic scenarios like Storytelling, Presenting, and Interviewing.

---

## **Build a Rep**

**Build a Rep** is Cognify’s personalized preparation environment. Users practice upcoming real-world communication events through AI-generated simulations based on their own context.

---

## **Communication Application**

A **Communication Application** is a real-world communication domain within Skill Lab. The MVP includes Storytelling, Presenting, Teaching, Interviewing, and Persuasion.

*(I still slightly prefer “Communication Application” over just “Application,” but if you want to keep “Application,” that’s completely fine.)*

---

## **Core Skills**

**Core Skills** are the six foundational communication abilities trained in Daily Workout: Clarity, Structure, Conciseness, Thinking Quality, Pacing, and Tone.

---

## **Hidden Skills**

**Hidden Skills** are the smallest communication abilities tracked by the AI behind the scenes. They power coaching, scoring, personalization, and adaptive training, but are not directly shown to users.

**Implementation Note:** Throughout this document, the terms *Subskills*, *Hidden Behaviors*, and *Underlying Behaviors* should all be interpreted as **Hidden Skills**.

# **2\. Training Terminology**

## **Exercise Framework**

An **Exercise Framework** is a reusable training template designed to develop a specific communication objective. Multiple Exercises can be generated from the same Exercise Framework.

---

## **Exercise**

An **Exercise** is a single communication activity completed by the user. Every Exercise is generated from an Exercise Framework and follows the Cognify Training System.

---

## **Prompt**

A **Prompt** is the topic, question, or scenario presented within an Exercise. Prompts provide variety without changing the communication objective being trained.

---

## **Coach’s Insight**

**Coach’s Insight** prepares the user before they begin an Exercise by highlighting one key communication behavior to focus on during their First Rep.

---

## **First Rep**

The **First Rep** is the user’s initial spoken attempt at an Exercise. It serves as the baseline performance used for evaluation and coaching.

---

## **Coach Feedback**

**Coach Feedback** is the AI-generated evaluation delivered after the First Rep. It includes the user’s Communication Score, Coach’s Focus, and Core Skill Breakdown.

---

## **Communication Score**

A **Communication Score** measures the quality of a user’s communication performance. Scores are used throughout Cognify to measure ability at the Exercise, Fundamental, Application, and Overall Communication levels.

---

## **Coach’s Focus**

The **Coach’s Focus** identifies the single highest-impact improvement the user should implement during their Retry.

---

## **Core Skill Breakdown**

The **Core Skill Breakdown** shows how the user performed across the six Core Skills, helping explain the overall Communication Score.

---

## **Retry**

A **Retry** is the user’s immediate second attempt at the same Exercise after receiving Coach Feedback. Its purpose is to implement the coaching while the feedback is still fresh.

---

## **Improvement Review**

The **Improvement Review** compares the First Rep and Retry, highlighting what improved, what still needs work, and reinforcing the value of immediate implementation.

---

## **Rep**

A **Rep** is a single spoken response completed by the user. Every Exercise includes at least a First Rep and one Retry.

# **3\. Content Terminology**

## **Exercise Library**

The **Exercise Library** is the complete collection of Exercise Frameworks available within Cognify. It serves as the foundation from which all Exercises are generated.

---

## **Exercise Bank**

An **Exercise Bank** is a collection of Exercise Frameworks grouped by a specific Core Skill or Communication Application.

---

## **Prompt Bank**

A **Prompt Bank** is the collection of Prompts associated with a particular Exercise Framework. Each Prompt trains the same communication objective while providing a different topic or scenario.

---

## **Exercise Rotation**

**Exercise Rotation** is the system responsible for determining which Exercise Frameworks a user completes during a training session. Rotation is designed to create balanced practice while minimizing unnecessary repetition.

---

## **Prompt Rotation**

**Prompt Rotation** is the system responsible for selecting Prompts within an Exercise Framework. Previously skipped or recently completed Prompts should not immediately reappear within the same session.

---

## **Adaptive Exercise Selection**

**Adaptive Exercise Selection** personalizes Exercise Framework selection based on a user’s Communication Profile, strengths, weaknesses, and training history.

---

## **Adaptive Prompt Selection**

**Adaptive Prompt Selection** personalizes Prompt selection to provide relevant, varied, and engaging speaking topics while supporting the objective of the selected Exercise Framework.

# **4\. Intelligence Terminology**

## **Intelligence Layer**

The **Intelligence Layer** is the collection of AI systems that power Cognify’s coaching, personalization, scoring, and long-term learning. It operates behind the scenes and is not directly visible to users.

---

## **Communication Profile**

The **Communication Profile** is the AI’s long-term understanding of a user’s communication abilities. It continuously evolves as users complete training and is used to personalize future learning experiences.

---

## **Hidden Skills**

**Hidden Skills** are the smallest measurable communication abilities tracked by the AI. They power coaching, scoring, personalization, and adaptive training but are not directly shown to users.

**Implementation Note:** Throughout this document, the terms *Subskills*, *Hidden Behaviors*, and *Underlying Behaviors* should all be interpreted as **Hidden Skills**.

---

## **Adaptive Training**

**Adaptive Training** personalizes the user’s learning experience by adjusting what they practice based on their Communication Profile, strengths, weaknesses, and training history.

---

## **Adaptive Coaching**

**Adaptive Coaching** tailors AI feedback to each user’s communication patterns, helping deliver increasingly relevant and personalized coaching over time.

---

## **Communication Insights**

**Communication Insights** are personalized observations generated from a user’s long-term training data. They help users understand trends, strengths, weaknesses, and areas for improvement.

---

## **Long-Term Memory**

**Long-Term Memory** is the AI’s ability to retain meaningful information about a user’s communication development across training sessions. It enables Cognify to deliver increasingly personalized coaching without requiring users to start from scratch each session.

# **5\. Progression Terminology**

## **Overall Communication Score**

The **Overall Communication Score** represents a user’s overall communication ability. It is calculated using performance across all Training Modes and serves as the primary measure of communication improvement.

---

## **Fundamental Scores**

**Fundamental Scores** measure performance across the six Core Skills trained within Daily Workout:

* Clarity  
* Structure  
* Conciseness  
* Thinking Quality  
* Pacing  
* Tone

---

## **Application Scores**

**Application Scores** measure performance within each Communication Application in Skill Lab, such as Storytelling, Presenting, Teaching, Interviewing, and Persuasion.

---

## **Cognify Rank**

**Cognify Rank** represents a user’s long-term progression through Cognify. Rank is earned through consistent training and sustained improvement over time and is independent of Communication Scores.

---

## **Rank Progress**

**Rank Progress** is the visual progress bar that shows a user’s advancement toward the next Cognify Rank. Progress increases as users complete meaningful training activities and demonstrate improvement.

---

## **Streak**

A **Streak** measures training consistency. A user’s Streak remains active by completing workouts on the days they committed to training each week.

---

## **Achievement**

An **Achievement** is a milestone earned for completing meaningful accomplishments within Cognify, such as training consistency, communication reps, or workout completion.

---

## **Leaderboard**

The **Leaderboard** allows users to compare their performance with other users. Leaderboards can be viewed by Overall Communication Score or by weekly communication improvement.

# Edits

# Build a Rep

![][image3]1\. Should be able to access my photo library, also we need to summarize the header better to show what I’m practicing in a cleaner way.

![][image4]2\. I told Cognify the three questions I wanted to practice but then it gave me all of these, I just want the 3 that I said, but then I should have the option to add questions too that aren’t there, let’s make it very configurable.   
 

![][image5]3\. The display for the actual rep page is off, it should just be my question. Also, I should have a text box to the side to fill in notes like we had for the previous version so I can use it to assist me when performing the rep. It should generate me a structure to speak off of and then I can edit where I see fit   

![][image6]  
4\. Too much jargon, the words needs to be simpler and no em-dashes \-

![][image7]![][image8]  
5\. For the coach’s focus, I should get a stronger version based off what I said and it shows me how to say it better, I also need better actionable insights based off what I said that I can use for a retry rep

![][image9]  
6\. I didn’t get feedback on anything from the core skills

![][image10]  
7\. The focus for this retry provides poor insights and its not good coaching. Also, for the apply during this rep part, those insights make no sense (I’m preparing for a interview) we really need to improve how we do the implementation rep in terms of the insights delivered and how it’s presented to the user. 

![][image11]8\. Need insights on my core skills and how I performed in terms of implementing the feedback it gave me (even though the insights weren’t great). Also need insights on how to be better for my next rep if I were to want to redo

![][image12]9\. The headers should be better worded for the events section and what does it mean by 0 critical moments? 

![][image13]  
10\. I completed my first rep, and I now am on the grading screen, and my only option is to retry. I feel like for build a rep we should have multiple options to either move on to the next rep, retry, or exit

11\. We need to figure out how to make the grading faster

![][image14]  
12\.  On the improvement review screen, I can’t see my recording, we need to add that for this screen.

[[EMBEDDED IMAGE STRIPPED - line 9113]]

[[EMBEDDED IMAGE STRIPPED - line 9115]]

[[EMBEDDED IMAGE STRIPPED - line 9117]]

[[EMBEDDED IMAGE STRIPPED - line 9119]]

[[EMBEDDED IMAGE STRIPPED - line 9121]]

[[EMBEDDED IMAGE STRIPPED - line 9123]]

[[EMBEDDED IMAGE STRIPPED - line 9125]]

[[EMBEDDED IMAGE STRIPPED - line 9127]]

[[EMBEDDED IMAGE STRIPPED - line 9129]]

[[EMBEDDED IMAGE STRIPPED - line 9131]]

[[EMBEDDED IMAGE STRIPPED - line 9133]]

[[EMBEDDED IMAGE STRIPPED - line 9135]]

[[EMBEDDED IMAGE STRIPPED - line 9137]]

[[EMBEDDED IMAGE STRIPPED - line 9139]]
