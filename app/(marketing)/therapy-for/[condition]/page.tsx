import Link from "next/link";
import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import {
  CheckList,
  CtaBand,
  CtaButton,
  Eyebrow,
  FaqList,
  RelatedLinks,
  Section,
  SectionHeading,
  faqJsonLd,
} from "@/app/components/marketing/sections";
import type { Faq } from "@/app/components/marketing/sections";
import { CONDITIONS } from "@/lib/navigation";
import type { ConditionSlug } from "@/lib/navigation";
import { MARKETS } from "@/lib/markets";
import { legalEntityName, pageMetadata, siteUrl } from "@/lib/seo";

/**
 * The eight condition pages.
 *
 * ── Why the copy lives in a map rather than in eight files ──
 * Every page here has the same clinical shape — what it looks like, when it is
 * worth talking to someone, what the therapy actually is, what the first
 * session is — and the shape is the part that has to stay consistent. Eight
 * hand-written files drift: one grows an outcome claim, one loses its crisis
 * line, one quietly starts promising a number of sessions. One renderer means
 * the crisis notice and the "we do not diagnose or prescribe" line are
 * structural, not something an author has to remember.
 *
 * ── The content rules these pages are written under ──
 * These are YMYL pages about mental illness, read by people who are unwell.
 * So: no outcome percentages, no "therapy will fix this", no invented client
 * counts, and no claim that Echo treats, diagnoses or prescribes. Modalities
 * are named (CBT, behavioural activation, EMDR, CBT-I) because naming them is
 * how someone decides whether this is the right service — but each is
 * described as what it *is*, never as what it will *do for you*.
 *
 * HIPAA is never mentioned anywhere on this site. It binds US covered entities
 * — health plans, US-billing providers and clearinghouses — and Echo is none of
 * those, whichever country a given client happens to be in. The instrument that
 * does govern these records is Kenya's Data Protection Act 2019, because that
 * is where the controller is.
 *
 * ── Where Kenya may and may not appear on these pages ──
 * As a disclosure: the licence the therapist holds, the clock availability is
 * published on, the currency the card is charged in. Never as the audience.
 * These eight pages are read from thirteen markets (`lib/markets.ts`), so the
 * day-to-day detail has to be recognisable to a reader in Lagos, London or
 * Toronto as readily as one in Nairobi. A previous pass had grief "flattened by
 * a song in a matatu", which quietly told twelve of the thirteen that the page
 * was not written for them.
 */

interface Approach {
  readonly name: string;
  readonly body: string;
}

interface ConditionContent {
  /** ≤ 60 chars — the root layout appends " | Echo Health". */
  readonly metaTitle: string;
  /** 140–160 chars. Shorter gets padded by Google; longer gets truncated. */
  readonly metaDescription: string;
  readonly h1: string;
  readonly eyebrow: string;
  /**
   * The noun phrase the section headings are built from — "sleep problems",
   * not the slug. Deriving headings from `CONDITIONS[].short` produced "What
   * therapy for sleep involves" and "What sleep problems looks like", so the
   * phrasing is stated once here rather than patched at each use site.
   */
  readonly topic: string;
  readonly intro: string;
  readonly dayToDay: readonly string[];
  readonly whenToTalk: readonly string[];
  /** Named modalities. Described, not promised. */
  readonly approaches: readonly Approach[];
  /** Paragraphs, so the section can breathe rather than being one wall. */
  readonly firstSession: readonly string[];
  /** Where this page has to say "that is not what we do". */
  readonly limits: string;
  readonly faqs: readonly Faq[];
}

const CONTENT: Record<ConditionSlug, ConditionContent> = {
  anxiety: {
    metaTitle: "Therapy for anxiety, online",
    metaDescription:
      "Online therapy for anxiety with therapists licensed in Kenya. What anxiety looks like day to day, how CBT and exposure work, and what a first session covers.",
    h1: "Therapy for anxiety",
    eyebrow: "What we help with",
    topic: "anxiety",
    intro:
      "Anxiety is not only worry. It is a body braced for something that has not happened, and a mind that keeps rehearsing it in case rehearsal helps. It is one of the most common reasons people look for a therapist, and one of the most treatable things to bring to one.",
    dayToDay: [
      "Worry that loops — the same scenario replayed with no point at which it resolves.",
      "A body that will not settle: tight chest, shallow breath, a stomach that turns before ordinary things.",
      "Avoiding what makes you anxious, which lowers the fear now and raises it next time.",
      "Lying awake, because being still is when the thinking starts.",
      "Short patience with the people you are closest to, then guilt about it.",
      "Checking, asking, re-reading, googling — reassurance that works for about an hour.",
    ],
    whenToTalk: [
      "It has run for weeks rather than days, and is not tracking one specific event that will pass.",
      "You are arranging your life around it — declining invitations, taking longer routes, not answering calls.",
      "It is showing up in your work, your studies, or how you are with your family.",
      "What used to take the edge off — exercise, a night out, a drink — has stopped working, or has become its own problem.",
    ],
    approaches: [
      {
        name: "Cognitive behavioural therapy (CBT)",
        body: "The most researched talking therapy for anxiety. You learn to catch the thought that starts the loop, test it against what you actually know rather than argue with it, and change what you do next — because the doing is usually what keeps it running.",
      },
      {
        name: "Graded exposure",
        body: "Anxiety tends to shrink when it is approached in planned, tolerable steps and to grow when it is avoided. Exposure work is built with your therapist, in an order you agree, at a pace you set. It is not being thrown in.",
      },
      {
        name: "Acceptance and commitment therapy (ACT)",
        body: "Moves the goal from getting rid of anxiety to being able to act on what matters while it is present. Useful when years of trying to eliminate the feeling have become the problem.",
      },
      {
        name: "Applied relaxation and breathing work",
        body: "Gives the body something concrete to do while the rest of the work catches up. Real, and worth learning — but a tool inside the therapy rather than the therapy itself.",
      },
    ],
    firstSession: [
      "The first fifty minutes are mostly your therapist listening and asking. Expect questions about when the anxiety started, what makes it worse, what you have already tried, how you are sleeping and eating, and whether anything is unsafe.",
      "You do not need to have it organised beforehand. \"I don't really know how to describe it\" is a normal opening and a workable one. By the end you should have a shared description of the problem and a first idea of where to start — and nothing you say obliges you to book again.",
    ],
    limits:
      "Echo therapists do not prescribe medication and do not issue formal diagnoses for insurance, school or court purposes. If medication is worth considering, that is a conversation with a doctor or psychiatrist, and therapy can run alongside it.",
    faqs: [
      {
        q: "Is online therapy any good for anxiety, or does it need to be in person?",
        a: "Both are real options. Video sessions remove the journey and the waiting room, which for some people with social or travel-related anxiety is the difference between starting and not starting. For others, being in a room matters. If sitting with someone in person is what you want, an in-person practice is the better choice and we would rather say so than sell you the wrong thing.",
      },
      {
        q: "Will I have to talk about my childhood?",
        a: "Not unless it turns out to be relevant and you want to. Anxiety work is often present-focused — what is happening this week, and what you do when it happens. Some people find the roots useful; plenty of good anxiety therapy never goes there.",
      },
      {
        q: "I get panic attacks. Is that the same thing?",
        a: "Related, but distinct enough to be worth naming at your first session. Panic attacks are short, intense surges with strong physical symptoms, and the fear of the next one often becomes its own problem. Tell your therapist early, because the work for panic has specific components that general anxiety work does not.",
      },
      {
        q: "Can I still book if I am already taking medication for anxiety?",
        a: "Yes. Many people do both. Echo does not prescribe or change medication — keep that with the doctor who prescribed it — but tell your therapist what you are taking so the two pieces of care are not working blind to each other.",
      },
    ],
  },

  depression: {
    metaTitle: "Therapy for depression, online",
    metaDescription:
      "Online therapy for depression with therapists licensed in Kenya. What depression feels like day to day, how behavioural activation and CBT work, what to expect.",
    h1: "Therapy for depression",
    eyebrow: "What we help with",
    topic: "depression",
    intro:
      "Depression is often described as sadness, and for many people that is not what it feels like at all. It is more commonly flatness — a day that costs three times what it used to, in which nothing is exactly wrong and nothing reaches you either.",
    dayToDay: [
      "Everything taking more effort than it should, including things you used to do without thinking.",
      "Losing interest in what you used to look forward to, and not being able to fake the interest back.",
      "Sleeping far too much, or waking at four and not getting back.",
      "A running self-critical commentary that sounds like fact rather than like a symptom.",
      "Withdrawing — leaving messages unanswered for days, then dreading the reply you owe.",
      "Concentration that will not hold, so reading a page or following a meeting becomes work.",
    ],
    whenToTalk: [
      "It has been most of most days for two weeks or more.",
      "It is affecting what you can actually do — at work, at home, with the people who depend on you.",
      "You have started to think you are the problem rather than that something is wrong.",
      "You are having thoughts of not wanting to be here. That is a reason to reach out today, not eventually — see the crisis lines above.",
    ],
    approaches: [
      {
        name: "Behavioural activation",
        body: "A structured way of putting activity back in before the motivation returns, because in depression motivation tends to follow action rather than arrive ahead of it. Unglamorous, specific, and one of the most consistently recommended approaches for depression.",
      },
      {
        name: "Cognitive behavioural therapy (CBT)",
        body: "Works on the thinking that depression makes sound reasonable — the conclusions about yourself and the future that feel like observations. You learn to notice them as thoughts and check them, rather than take dictation from them.",
      },
      {
        name: "Interpersonal-focused work",
        body: "Depression often sits inside something: a loss, a role that changed, a relationship that went quiet. This works on the situation rather than only on the symptoms.",
      },
      {
        name: "Compassion-focused approaches",
        body: "For the people whose depression is carried mostly by self-attack. Learning a different internal tone is skill work, not positive thinking.",
      },
    ],
    firstSession: [
      "Your therapist will ask how long it has been like this, what a normal day looks like now compared with a year ago, how you are sleeping and eating, and what support you have around you. They will also ask directly about thoughts of suicide or self-harm. That question is routine and it is asked of everyone — answering it honestly is what lets a therapist help.",
      "You do not need to arrive with a plan or with the right words. If talking is hard that day, say so; a good first session can be a slow one.",
    ],
    limits:
      "Echo therapists do not prescribe or adjust antidepressants, and cannot issue a diagnosis for a sick note, an insurer or a court. Therapy and medication are not competing options — if medication is worth considering, see a doctor, and the two can run side by side.",
    faqs: [
      {
        q: "I do not feel sad. Can it still be depression?",
        a: "Yes. Flatness, numbness, irritability and exhaustion are as common a presentation as sadness, and in men in particular irritability is often the surface of it. The question a therapist works with is not whether you feel sad but whether your capacity and your interest have dropped and stayed down.",
      },
      {
        q: "Do I have to choose between therapy and medication?",
        a: "No, and framing it as a choice is usually unhelpful. They do different things and many people use both. Echo does not prescribe — that stays with your doctor — but a therapist can help you think through the question and work alongside whatever you decide.",
      },
      {
        q: "I can barely get out of bed. How am I supposed to commit to sessions?",
        a: "That is worth saying out loud at the first session rather than treating as a reason not to start. Sessions are online, so there is no journey to manage, and if you need to move one, cancelling at least 24 hours ahead returns the credit to your account. Credits do not expire.",
      },
      {
        q: "How long does therapy for depression take?",
        a: "Nobody can honestly tell you that in advance, and be careful of anyone who does. Some people come with a specific focus and work through it in a handful of sessions; others need longer. What you can ask for, early, is a shared sense of what you are working on and how you will both know whether it is helping.",
      },
    ],
  },

  stress: {
    metaTitle: "Therapy for stress and burnout, online",
    metaDescription:
      "Online therapy for stress and burnout with therapists licensed in Kenya. How burnout differs from a hard week, what therapy can change, and what it cannot.",
    h1: "Therapy for stress and burnout",
    eyebrow: "What we help with",
    topic: "stress and burnout",
    intro:
      "Stress is not automatically a problem — it is what a person does under load, and most of the time it recedes when the load does. It becomes something to bring to a therapist when the recovery stops happening: when the weekend no longer resets you and the exhaustion is still there on Monday morning.",
    dayToDay: [
      "Tiredness that sleep does not fix, including after a full night.",
      "Dread arriving on Sunday afternoon, ahead of anything actually happening.",
      "Small tasks feeling disproportionately large — an email you cannot make yourself send.",
      "Going cynical about work you used to care about, and hearing yourself do it.",
      "Physical carriers: headaches, jaw, gut, a chest that is tight for no reason you can point to.",
      "Snapping at home, where it is safe to, about things that are not the reason.",
    ],
    whenToTalk: [
      "The recovery has stopped — time off helps for a day and then it is back.",
      "You are managing it with something that is becoming its own issue: alcohol, sleep aids, more hours.",
      "Your health is showing it, or your doctor has said so.",
      "You are making decisions from exhaustion — resigning at midnight, escalating conversations you would normally hold.",
    ],
    approaches: [
      {
        name: "CBT for stress",
        body: "Separates the load from the thinking about the load — the standards, the sense of being personally responsible for everything, the belief that stopping is what will make it collapse. Those are workable in a way the workload often is not.",
      },
      {
        name: "Problem-solving therapy",
        body: "A structured method for situations where there genuinely is a problem to solve and the stress has made it impossible to think about clearly. Deliberately practical.",
      },
      {
        name: "Boundary and values work",
        body: "What you are protecting, what you keep agreeing to, and what saying no would actually cost. Often the most uncomfortable and most useful part.",
      },
      {
        name: "Recovery and sleep work",
        body: "Burnout and broken sleep usually arrive together and feed each other. A therapist may work on the sleep first, because very little else moves while it is this bad.",
      },
    ],
    firstSession: [
      "Expect a fairly detailed picture of your week: hours, demands, what you control, what you do not, who you are responsible for, and what recovery you actually get rather than what you are supposed to get.",
      "Somewhere in that first fifty minutes there is usually a question worth sitting with — whether what you are describing is a period of load or a situation that has stopped being survivable in its current shape.",
    ],
    limits:
      "Therapy cannot change your workload, fix a difficult manager, or write you a sick note. What it can do is help you see the situation without the fog, decide what you are going to do about it, and make the recovery you do get count for more.",
    faqs: [
      {
        q: "Is burnout a medical condition?",
        a: "Not as such. The World Health Organization classifies burnout as an occupational phenomenon rather than a medical condition — it describes something about the relationship between a person and their work, characterised by exhaustion, mental distance from the job, and reduced effectiveness. That matters practically: burnout is real, and it is also not a diagnosis a therapist can put on a form for you.",
      },
      {
        q: "My job is the problem. Is there any point in therapy?",
        a: "Sometimes the honest answer is that the situation has to change, and a good therapist will say so rather than help you tolerate something intolerable. Therapy is still useful for getting to that decision clearly instead of at 2am, and for what happens next — the conversation, the exit, or the rebuild.",
      },
      {
        q: "Can I have sessions during the working day?",
        a: "Therapists set their own availability, and evening and early-morning slots are common precisely because of this. Sessions run 50 minutes, so a lunch hour usually works. All availability is published in East Africa Time (GMT+3), so if you are working in another time zone, check the slot against your own diary before you take it — your country page does the arithmetic.",
      },
      {
        q: "Can my employer find out?",
        a: "Not from us. Echo does not report attendance to anyone, and what happens in a session is held under the confidentiality terms your therapist explains at the start. If your employer is paying through an organisational arrangement, ask us exactly what they receive before you begin — we will tell you plainly.",
      },
    ],
  },

  trauma: {
    metaTitle: "Therapy for trauma and PTSD, online",
    metaDescription:
      "Online therapy for trauma and PTSD with therapists licensed in Kenya. What trauma looks like day to day, how trauma-focused CBT and EMDR work, what to expect.",
    h1: "Therapy for trauma and PTSD",
    eyebrow: "What we help with",
    topic: "trauma",
    intro:
      "Trauma is not defined by how bad the event looks from outside. It is defined by what it did to a nervous system that had to survive it — and by the fact that, afterwards, part of you keeps responding as though it is still happening.",
    dayToDay: [
      "Memories that arrive unasked, in fragments, with the feeling attached rather than the story.",
      "Being permanently on watch — sitting where you can see the door, reading rooms before you enter them.",
      "Avoiding places, people, conversations or news that get close to it, and the world getting smaller as a result.",
      "Numbness and distance, including from people you love, which is often mistaken for not caring.",
      "Nightmares and broken sleep, and dreading sleep because of them.",
      "Startling badly at ordinary noise, then feeling foolish about it.",
    ],
    whenToTalk: [
      "It has been more than a month and it is not settling on its own — many acute reactions do settle, and that is not failure either way.",
      "You are organising your life around avoiding reminders.",
      "You are using alcohol or anything else to get to sleep or to get through.",
      "Something recent has brought an old event back, which is common and does not mean you are back at the beginning.",
    ],
    approaches: [
      {
        name: "Trauma-focused CBT",
        body: "Structured work on the memory and on the beliefs that formed around it — about danger, about blame, about what it says about you. Together with EMDR it is among the most consistently recommended approaches for PTSD in international treatment guidelines.",
      },
      {
        name: "EMDR",
        body: "Eye movement desensitisation and reprocessing: a protocol in which you hold the memory in mind while following a repeated left-right stimulus, in short sets, with the therapist tracking what shifts. It can be delivered over video — ask a therapist how they run it online, and confirm they are EMDR-trained, because not every therapist is.",
      },
      {
        name: "Stabilisation and grounding",
        body: "The part that comes first and is often skipped in descriptions of trauma therapy. Before any work on the memory itself, you build ways to stay present and to come back down. Nobody should be taken into the worst thing that happened to them without that in place.",
      },
      {
        name: "Work on what came after",
        body: "For many people the lasting damage is not only the event but what followed it — not being believed, having to keep working, having to hold a family together. That is legitimate material for therapy in its own right.",
      },
    ],
    firstSession: [
      "You will not be asked to tell the story in detail at a first session, and you should be wary of anyone who pushes for it. The first session is about the shape of it: roughly what happened, how long ago, what it is doing to you now, and what makes it worse.",
      "You control the pace. \"I am not ready to talk about that yet\" is a complete and acceptable answer, and a trauma-trained therapist will treat it as information rather than as resistance.",
    ],
    limits:
      "Echo is online therapy, not an emergency or inpatient service, and we do not prescribe or issue medico-legal reports. If you are currently unsafe, or the person who harmed you still has access to you, say that at the outset — the first priority is safety, not processing.",
    faqs: [
      {
        q: "Do I have to describe what happened?",
        a: "Not in order to start, and not before you are ready. Some trauma approaches do involve working through the memory in detail at some stage, and your therapist should explain that clearly and get your agreement before you begin — not spring it on you mid-session.",
      },
      {
        q: "Can EMDR be done over video?",
        a: "Yes, EMDR is widely delivered online, with the bilateral stimulus presented on screen or self-administered with the therapist guiding. Ask the therapist directly how they run it remotely and what they do if you become distressed, since you are not in the room with them.",
      },
      {
        q: "What if I get overwhelmed during an online session?",
        a: "That is a fair question and one to raise before it happens. A trauma-trained therapist will agree a plan with you at the start — how you signal to slow down or stop, what grounding you will use, and who they can contact if you are unsafe. Keep your emergency contact details accurate for that reason.",
      },
      {
        q: "It happened years ago. Is it too late?",
        a: "No. People bring trauma to therapy decades later, often when something else has stirred it, and time since the event is not what determines whether the work is useful.",
      },
    ],
  },

  grief: {
    metaTitle: "Therapy for grief and loss, online",
    metaDescription:
      "Online therapy for grief and loss with therapists licensed in Kenya. Why grief is not an illness, when to talk to someone about it, and what therapy involves.",
    h1: "Therapy for grief and loss",
    eyebrow: "What we help with",
    topic: "grief",
    intro:
      "Grief is not a disorder and most of it does not need a therapist. It is what love does when the person is gone, and it runs its own course in its own time. Therapy becomes useful at the points where it stops moving, or where there is no one left to say it to.",
    dayToDay: [
      "Waves rather than a slope — fine for a week, then flattened by a song on the radio.",
      "Doing the practical things impeccably and having nothing left for anyone, including yourself.",
      "Guilt about the last conversation, the thing not said, the time not taken.",
      "Anger — at a hospital, at a relative, at the person for going — and shame about the anger.",
      "Forgetting for a moment, then remembering, which is its own small injury each time.",
      "Losing the things that came with the person too: a role, an income, a family that has gone quiet.",
    ],
    whenToTalk: [
      "Months on, you are not able to function in the way you need to, and it is not easing at all.",
      "The death was sudden, violent, or something you witnessed — grief and trauma together behave differently from grief alone.",
      "The relationship was complicated, or estranged, and you are grieving something that was never resolved.",
      "You are having thoughts of joining them. That is a today conversation — see the crisis lines above.",
    ],
    approaches: [
      {
        name: "Grief-focused therapy",
        body: "Mostly a place to say it, in full, to someone who will not change the subject and does not need protecting from it. That sounds modest and is frequently the whole of what helps.",
      },
      {
        name: "Continuing-bonds work",
        body: "Grief work is not about severing the connection or \"moving on\". It is about finding a form the relationship can keep, one you can carry rather than one that flattens you.",
      },
      {
        name: "Approaches for prolonged grief",
        body: "Where intense grief persists and stays disabling long after the loss, that pattern is now recognised in the international diagnostic manuals as prolonged grief disorder, and there are specific structured approaches for it. Naming it is sometimes a relief in itself.",
      },
      {
        name: "Trauma-informed work, when the death was traumatic",
        body: "If intrusive images of how they died sit between you and any memory of how they lived, the trauma usually has to be addressed before the grieving can proceed.",
      },
    ],
    firstSession: [
      "Bring as much or as little as you want. Many people spend a first session simply telling a stranger who the person was, which is harder to do with family — everyone there is grieving too, and you end up managing each other.",
      "Your therapist will ask about the death, about what support you have, and about how you are sleeping and eating, because grief is physical as much as emotional.",
    ],
    limits:
      "Grief is not treated, and a therapist who offers to make it go away on a schedule is offering something nobody can deliver. What therapy offers is company and structure through it, and help if it has genuinely got stuck.",
    faqs: [
      {
        q: "How long after a death should I wait before starting therapy?",
        a: "There is no correct interval. Some people want someone to talk to in the first fortnight; others find the need arrives months later, once the funeral is over and the visitors have stopped coming. Both are normal starting points.",
      },
      {
        q: "Everyone around me has moved on and I have not. Is something wrong with me?",
        a: "Almost certainly not. Communal mourning tends to be intense and then finish, and the weeks after a funeral are often the busiest of a person's life — so the grief itself frequently arrives once everyone else has gone home and expects you to be fine.",
      },
      {
        q: "Can I get therapy for a loss that was not a death?",
        a: "Yes. Divorce, estrangement, a miscarriage, a diagnosis, leaving a country, the end of a career — these are real losses and they grieve like losses. You do not need anyone's permission to treat them as such.",
      },
      {
        q: "Is it normal to feel relief?",
        a: "Yes, and it is one of the most common things people are afraid to say out loud — after a long illness, after caring for someone for years, after a difficult relationship. Relief and love are not mutually exclusive, and a therapist will not be shocked by it.",
      },
    ],
  },

  relationships: {
    metaTitle: "Therapy for relationship difficulties",
    metaDescription:
      "Online therapy for relationship difficulties with therapists licensed in Kenya — conflict, trust and patterns. What individual and couples work each involve.",
    h1: "Therapy for relationship difficulties",
    eyebrow: "What we help with",
    topic: "relationship difficulties",
    intro:
      "Relationship difficulties are not only about romantic partners. They are about the repeating shape of how you are with other people — the argument that always goes the same way, the friendship that keeps costing you, the parent whose approval still sets the temperature of your week.",
    dayToDay: [
      "The same argument, in different clothes, arriving every few weeks and resolving nothing.",
      "Managing the room — reading a mood at the door and adjusting yourself before anyone speaks.",
      "Avoiding conflict so thoroughly that the resentment has nowhere to go but inward.",
      "Feeling unseen by someone who is right there, and not knowing how to say it without it becoming an accusation.",
      "Checking, doubting and re-reading after a betrayal, long after you decided to stay.",
      "Knowing a relationship is not working and being unable to leave it, for reasons that are rarely as simple as they sound.",
    ],
    whenToTalk: [
      "The same pattern has followed you across several relationships.",
      "You are having conversations in your head that you cannot have out loud.",
      "Trust has been broken and neither of you knows what rebuilding would even look like.",
      "You are trying to decide whether to stay, and cannot think straight about it alone.",
    ],
    approaches: [
      {
        name: "Emotionally focused therapy (EFT)",
        body: "Works with the cycle a couple falls into — one pursues, one withdraws, both end up further away — and with what each person is actually afraid of underneath it. Designed for couples; also used to inform individual work.",
      },
      {
        name: "Gottman-informed couples work",
        body: "Practical and behavioural: how conflict starts, what escalates it, how repair happens, and what ordinary daily connection looks like between the big conversations.",
      },
      {
        name: "Attachment-informed individual therapy",
        body: "For the pattern rather than the person — why closeness sets off alarm, or why distance does. Useful when the same dynamic keeps reappearing regardless of who you are with.",
      },
      {
        name: "Assertiveness and communication work",
        body: "Skills, practised rather than discussed: saying the thing, holding the position, and tolerating someone being disappointed in you.",
      },
    ],
    firstSession: [
      "If you come alone, the first session maps the relationships that matter and the pattern you keep hitting. You can work on a relationship on your own — it is not second best, and it is the only option when the other person will not come.",
      "If you come as a couple, expect the therapist to give both of you the floor and to decline to arbitrate. A couples therapist is not there to rule on who is right, and one who does has stopped being useful to either of you.",
    ],
    limits:
      "If you are afraid of your partner, joint sessions are not the right first step: speaking honestly in front of someone you fear can increase the risk to you afterwards. Start individually, and tell your therapist what is happening. If you are in immediate danger, use the crisis lines above.",
    faqs: [
      {
        q: "My partner will not come. Is there any point?",
        a: "Yes. Individual therapy on a relationship is common and useful — you can only change your own half of a pattern anyway, and changing it often changes the pattern. It is also the right route if joint sessions would not be safe.",
      },
      {
        q: "What is the difference between this and couples therapy?",
        a: "This page is about relationship difficulties wherever they show up, including ones you work on alone. Couples therapy specifically means both partners in the session together, working on the relationship itself as the client. If that is what you want, start on the couples therapy page.",
      },
      {
        q: "Will the therapist tell us whether to break up?",
        a: "No, and that is not a dodge. A therapist who decides that for you has taken the decision out of the hands of the people who have to live with it. What they will do is help you both see the relationship clearly enough that the decision becomes yours to make.",
      },
      {
        q: "Can we talk about family and in-laws, not just the two of us?",
        a: "Yes, and a lot of couples work is exactly that — extended family expectations, obligations to parents, money that moves between households, and decisions neither partner feels free to make alone.",
      },
    ],
  },

  "self-esteem": {
    metaTitle: "Therapy for low self-esteem, online",
    metaDescription:
      "Online therapy for low self-esteem with therapists licensed in Kenya. What the inner critic sounds like day to day, how compassion-focused and CBT work goes.",
    h1: "Therapy for low self-esteem",
    eyebrow: "What we help with",
    topic: "low self-esteem",
    intro:
      "Low self-esteem is rarely experienced as an opinion about yourself. It is experienced as accuracy — the sense that you are simply seeing yourself clearly, and that everyone else is being polite. That is exactly what makes it so hard to argue your way out of alone.",
    dayToDay: [
      "A running commentary that would end a friendship if you used it on anyone else.",
      "Apologising reflexively, including for things that are not yours.",
      "Being unable to take a compliment without immediately discounting it.",
      "Perfectionism that is not about standards but about pre-empting criticism.",
      "Saying yes when you have nothing left, because the alternative is being a disappointment.",
      "Comparing constantly, and only ever against the thing you are worst at.",
    ],
    whenToTalk: [
      "It is shaping decisions — jobs you do not apply for, people you do not approach, things you talk yourself out of before trying.",
      "It has been there long enough that you assume it is your personality rather than something that formed.",
      "It sits underneath something else — low mood, anxiety, an eating problem, a relationship you know is not good for you.",
      "You can see it is not true about other people in the same position, and that still changes nothing about how you see yourself.",
    ],
    approaches: [
      {
        name: "CBT for self-critical thinking",
        body: "Treats the judgements as claims rather than as facts, and tests them — including with behavioural experiments, where you find out what actually happens rather than predicting it.",
      },
      {
        name: "Compassion-focused therapy (CFT)",
        body: "Developed specifically for people whose main difficulty is shame and self-attack, and for whom standard thought-challenging bounces off. The work is on building a different internal tone, which is a trainable skill rather than a slogan.",
      },
      {
        name: "Schema-focused work",
        body: "For beliefs that formed early and have been operating ever since — the ones that feel less like thoughts and more like the water you swim in.",
      },
      {
        name: "Assertiveness practice",
        body: "Concrete and rehearsed: asking for something, declining something, and surviving the discomfort that follows. Self-esteem tends to follow evidence, and this is how the evidence gets made.",
      },
    ],
    firstSession: [
      "Expect questions about when you first remember feeling this way, whose voice the criticism sounds like, and where it is loudest now — work, family, appearance, money, relationships.",
      "Your therapist may also ask what you are afraid would happen if you were easier on yourself, because there is almost always an answer, and it is usually the thing holding the whole structure up.",
    ],
    limits:
      "Self-esteem is frequently a symptom rather than the root — of depression, of anxiety, of something that happened to you, or of an eating disorder. A therapist will look for that. If an eating disorder is in the picture, say so early: it needs specialist input and may need medical monitoring we do not provide.",
    faqs: [
      {
        q: "Is this just positive thinking?",
        a: "No, and if it were it would not work — most people with low self-esteem have already tried affirmations and found they bounce straight off. The work is closer to gathering evidence and changing how you treat yourself in practice than to telling yourself things you do not believe.",
      },
      {
        q: "I have felt this way since childhood. Can that change?",
        a: "Long-standing beliefs are workable; how long it takes varies and nobody can promise you a timeline. What is fair to say is that people who have felt this way for decades do bring it to therapy, and the fact that it formed early does not make it permanent.",
      },
      {
        q: "Is low self-esteem a mental illness?",
        a: "It is not a diagnosis on its own. It is a pattern that frequently accompanies conditions that are, which is why a therapist will ask about mood, anxiety and eating rather than take it in isolation.",
      },
      {
        q: "I am embarrassed to spend money on this. Is it serious enough for therapy?",
        a: "You do not need a diagnosis or a crisis to qualify for therapy, and \"this has quietly shaped my life for twenty years\" is as legitimate a reason as any. If cost is the concern, a single session is a real option — there is no subscription and nothing renews.",
      },
    ],
  },

  sleep: {
    metaTitle: "Therapy for sleep problems and insomnia",
    metaDescription:
      "Online therapy for sleep problems with therapists licensed in Kenya. How CBT-I works, when it needs a doctor instead, and what a first session covers.",
    h1: "Therapy for sleep problems",
    eyebrow: "What we help with",
    topic: "sleep problems",
    intro:
      "Chronic poor sleep is not only tiring. It changes mood, concentration, patience and judgement, and it is very often both a symptom of something else and a cause of it — which is why treating the sleep directly is frequently where a therapist starts.",
    dayToDay: [
      "Lying awake for an hour or more with a mind that only switches on at night.",
      "Waking at three and doing arithmetic about how much is left.",
      "Watching the clock, then doing sums about tomorrow, which guarantees the next hour.",
      "Dreading bedtime, so putting it off, so being more tired and more wired.",
      "Getting through the day in a fog, with coffee doing structural work.",
      "Sleeping badly for so long that you have stopped expecting anything else.",
    ],
    whenToTalk: [
      "It has been most nights for a month or more.",
      "It is affecting your day — driving, work, temper, how you are with your family.",
      "You are relying on alcohol or over-the-counter sedatives to get to sleep.",
      "It arrived with low mood, anxiety or a trauma, and the two are now holding each other up.",
    ],
    approaches: [
      {
        name: "CBT-I",
        body: "Cognitive behavioural therapy for insomnia: a structured, specific approach that is recommended in international guidelines as the first-line treatment for chronic insomnia in adults, ahead of sleeping tablets. It is not general talking therapy with sleep as the topic.",
      },
      {
        name: "Sleep consolidation and stimulus control",
        body: "The core components of CBT-I, and the counter-intuitive part: temporarily narrowing time in bed, and re-teaching your body that bed means sleep rather than lying there frustrated. It usually feels worse before it feels better, so it is done with a therapist rather than from an article.",
      },
      {
        name: "Cognitive work about sleep",
        body: "The beliefs that run at 2am — that tomorrow is ruined, that you cannot function on this, that you have lost the ability to sleep. The anxiety about sleep is often a larger part of the problem than the sleep.",
      },
      {
        name: "Working on what is underneath",
        body: "When insomnia sits on depression, anxiety, grief or trauma, the sleep work and the underlying work usually run together rather than one waiting for the other.",
      },
    ],
    firstSession: [
      "Expect detail: what time you go up, how long it takes, how often you wake, when you finally get up, what you do in the night, caffeine, alcohol, screens, shift patterns and naps. Your therapist may ask you to keep a sleep diary for a week or two, because memory of a bad night is unreliable.",
      "You will also be asked about mood and stress, since the three are almost always entangled.",
    ],
    limits:
      "Sleep problems can have medical causes — sleep apnoea, thyroid problems, pain, medication side effects, restless legs. Therapy does not diagnose or treat those, and Echo does not prescribe. If you snore heavily, gasp or stop breathing in the night, or are exhausted despite enough hours in bed, see a doctor first.",
    faqs: [
      {
        q: "Is CBT-I really better than sleeping tablets?",
        a: "International guidelines recommend CBT-I as the first-line treatment for chronic insomnia in adults, before medication. That is a statement about what the guidelines say, not a promise about your particular sleep — and if you are already on a prescribed sleep medication, do not change it because of a web page. Talk to the doctor who prescribed it.",
      },
      {
        q: "Can this be done online?",
        a: "Yes. CBT-I is structured and largely education, measurement and planning, which translates well to video. A diary and a weekly 50-minute session is a workable format.",
      },
      {
        q: "I sleep fine at weekends. Is that still insomnia?",
        a: "Possibly not insomnia as such — it may be a body clock problem, a shift pattern, or stress with a very specific trigger. It is worth bringing anyway, because the useful approach differs and telling them apart is part of the first session.",
      },
      {
        q: "What if my sleep is bad because of anxiety or depression?",
        a: "Very common, and it does not mean the sleep has to wait. Sleep work frequently runs alongside the work on mood, and improving sleep often makes the rest of the therapy more possible.",
      },
    ],
  },
};

/* ── Route generation ────────────────────────────────────────────────────── */

/**
 * Eight static pages, and only eight.
 *
 * `dynamicParams = false` is what makes `/therapy-for/adhd` a 404 rather than a
 * runtime render of a slug we have no content for. A page that renders for any
 * string is how a thin doorway page gets generated for a condition nobody wrote
 * copy for — which is both a ranking liability and, on a mental-health site, a
 * page promising help we have not described.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return CONDITIONS.map((c) => ({ condition: c.slug }));
}

function lookup(slug: string) {
  const meta = CONDITIONS.find((c) => c.slug === slug);
  if (!meta) return null;
  return { meta, content: CONTENT[meta.slug] };
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly condition: string }>;
}) {
  const { condition } = await params;
  const found = lookup(condition);
  if (!found) return {};
  return pageMetadata({
    title: found.content.metaTitle,
    description: found.content.metaDescription,
    path: `/therapy-for/${found.meta.slug}`,
  });
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function ConditionPage({
  params,
}: {
  readonly params: Promise<{ readonly condition: string }>;
}) {
  const { condition } = await params;
  const found = lookup(condition);
  if (!found) notFound();
  const { meta, content } = found;

  /* Siblings first, then the service pages: the point of this rail is that a
     condition page is never a leaf. See `RelatedLinks` in the section kit. */
  const related = [
    ...CONDITIONS.filter((c) => c.slug !== meta.slug).map((c) => ({
      href: `/therapy-for/${c.slug}`,
      label: `Therapy for ${c.short}`,
    })),
    { href: "/individual-therapy", label: "Individual therapy" },
    { href: "/couples-therapy", label: "Couples therapy" },
    { href: "/teen-therapy", label: "Teen therapy" },
    { href: "/online-therapy", label: "How online therapy works" },
  ];

  const medicalWebPage = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: content.h1,
    description: content.metaDescription,
    url: `${siteUrl}/therapy-for/${meta.slug}`,
    inLanguage: "en",
    about: { "@type": "MedicalCondition", name: meta.label },
    /* `audience` rather than any claim of treatment: this page describes a
       service, it does not deliver care, and MedicalWebPage properties that
       imply clinical guidance are deliberately left off. */
    audience: { "@type": "Patient" },
    provider: {
      "@type": "Organization",
      name: legalEntityName,
      url: siteUrl,
      /* Was `{ name: "Kenya" }`, which said this service is available in one
         country. It describes where the clinicians are licensed, not where the
         readers are; the list is read from `lib/markets.ts`. */
      areaServed: MARKETS.map((m) => ({
        "@type": "Country",
        name: m.country.replace(/^the /, ""),
      })),
    },
  };

  return (
    <>
      <Breadcrumbs
        trail={[
          { href: "/therapy-for", label: "What we help with" },
          { href: `/therapy-for/${meta.slug}`, label: meta.label },
        ]}
      />
      <JsonLd data={medicalWebPage} />
      <JsonLd data={faqJsonLd(content.faqs)} />

      {/* Hero. `bg-hero-soft` shares its base colour with the page ground, so
          the breadcrumb strip above it reads as part of the same surface. */}
      <section className="curve-down bg-hero-soft px-4 pb-24 pt-8 [--curve-to:#fff] sm:px-6 sm:pb-32 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{content.eyebrow}</Eyebrow>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            {content.h1}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            {content.intro}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/get-started">Find your therapist</CtaButton>
            <CtaButton href="/online-therapy" variant="secondary">
              How online therapy works
            </CtaButton>
          </div>

          {/* The crisis line is required on every condition page, is placed
              above the fold on a phone, and is never rendered as a footnote.
              Someone in crisis should not have to read a marketing page to
              find out that this is not the service they need right now. */}
          <div className="mx-auto mt-10 flex max-w-xl items-start gap-3 rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-stone-200">
            <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
            <p className="text-sm leading-6 text-stone-600">
              If you need help right now, Echo is not the right place. Contact
              your local emergency number, or see our{" "}
              <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                verified crisis lines
              </Link>
              , which include a directory that finds one wherever you are.
            </p>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              title={`What ${content.topic} can look like day to day`}
              body="Nobody arrives with a diagnosis. People arrive with a week that felt like this."
            />
            <ul className="mt-9 flex flex-col gap-4">
              {content.dayToDay.map((item) => (
                <li
                  key={item}
                  className="rounded-3xl bg-stone-50 p-5 text-[15px] leading-7 text-stone-700 ring-1 ring-stone-200/70"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:pt-2">
            <SectionHeading
              align="left"
              as="h3"
              title="When it is worth talking to someone"
              body="There is no threshold you have to clear. These are the signals that usually mean it is time."
            />
            <div className="mt-9 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <CheckList items={content.whenToTalk} />
            </div>
            <p className="mt-6 rounded-3xl bg-brand-50 p-6 text-sm leading-7 text-stone-700 ring-1 ring-brand-100">
              {content.limits}
            </p>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="The actual work"
          title={`What therapy for ${content.topic} involves`}
          body="These are recognised approaches a therapist may draw on. Which one fits is a conversation with your therapist, not something a website can decide — and none of them is a guaranteed outcome."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {content.approaches.map((a) => (
            <div key={a.name} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <h3 className="font-semibold text-stone-900">{a.name}</h3>
              <p className="mt-3 text-[15px] leading-7 text-stone-600">{a.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Your first session"
            title="What actually happens in the first fifty minutes"
          />
          <div className="mt-8 flex flex-col gap-5">
            {content.firstSession.map((para) => (
              <p key={para.slice(0, 40)} className="text-[17px] leading-8 text-stone-600">
                {para}
              </p>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title={`Therapy for ${content.topic}: common questions`}
          />
          <FaqList faqs={content.faqs} />
        </div>
      </Section>

      <CtaBand
        title="Start when you are ready"
        body="Answer a few questions and we will match you with a licensed therapist. Nothing is shared until you create an account, and you can stop at any point."
        label="Find your therapist"
      />

      <RelatedLinks title="Related pages" links={related} />
    </>
  );
}
