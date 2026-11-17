import en from "./dictionaries/en.json";
import si from "./dictionaries/si.json";
import { formatDate, formatMoney } from "./format";
import { fill } from "./text";
import type { Reminder } from "./data/reminders";

// WhatsApp messages the agent can send with one tap. They follow the
// client's preferred language, not the language the app is shown in.

const templates = {
  en: {
    premium:
      "Hello {name}, a friendly reminder that the premium of {amount} for your {type} policy {number} is due on {date}. Thank you. – {agent}",
    premiumLate:
      "Hello {name}, the premium of {amount} for your {type} policy {number} was due on {date}. Please let me know when it's convenient to pay. Thank you. – {agent}",
    renewal:
      "Hello {name}, your {type} policy {number} is due for renewal on {date}. Let me know a good time to go through the renewal. Thank you. – {agent}",
    birthday: "Happy birthday, {name}! Wishing you good health and happiness in the year ahead. – {agent}",
    familyBirthday: "Hello {name}, wishing {member} a very happy birthday! – {agent}",
  },
  si: {
    premium:
      "ආයුබෝවන් {name}, ඔබගේ {type} රක්ෂණ ඔප්පුවේ ({number}) {amount} වාරිකය {date} දිනට ගෙවිය යුතු බව කාරුණිකව මතක් කරමි. ස්තූතියි. – {agent}",
    premiumLate:
      "ආයුබෝවන් {name}, ඔබගේ {type} රක්ෂණ ඔප්පුවේ ({number}) {amount} වාරිකය {date} දිනට ගෙවිය යුතුව තිබුණි. ඔබට පහසු වේලාවක් කරුණාකර මට දන්වන්න. ස්තූතියි. – {agent}",
    renewal:
      "ආයුබෝවන් {name}, ඔබගේ {type} රක්ෂණ ඔප්පුව ({number}) {date} දිනට අලුත් කළ යුතුයි. අලුත් කිරීම ගැන කතා කිරීමට ඔබට පහසු වේලාවක් දන්වන්න. ස්තූතියි. – {agent}",
    birthday: "සුබ උපන්දිනයක් වේවා {name}! ඉදිරි වසර නිදුක් නිරෝගී සතුටින් පිරි එකක් වේවායි ප්‍රාර්ථනා කරමි. – {agent}",
    familyBirthday: "ආයුබෝවන් {name}, {member}ට සුබ උපන්දිනයක් වේවා! – {agent}",
  },
} as const;

const dictionaries = { en, si } as const;

/** The message for a reminder, or null when there's nothing standard to say (follow-ups). */
export function reminderMessage(reminder: Reminder, agentName: string | null): string | null {
  const lang = reminder.client.preferred_language;
  const t = templates[lang];
  const dict = dictionaries[lang];
  const agent = agentName ?? "";
  const base = {
    name: reminder.client.full_name,
    agent,
    date: formatDate(reminder.due_on, dict.calendar, lang),
  };
  const policy = reminder.policy;
  const policyValues = policy
    ? {
        type: lang === "en" ? dict.policyTypes[policy.type].toLowerCase() : dict.policyTypes[policy.type],
        number: policy.policy_number,
        amount: formatMoney(policy.premium, lang),
      }
    : null;

  let text: string;
  switch (reminder.kind) {
    case "premium":
      if (!policyValues) return null;
      text = fill(reminder.days_left < 0 ? t.premiumLate : t.premium, { ...base, ...policyValues });
      break;
    case "renewal":
      if (!policyValues) return null;
      text = fill(t.renewal, { ...base, ...policyValues });
      break;
    case "birthday":
      text = reminder.family
        ? fill(t.familyBirthday, { ...base, member: reminder.family.full_name })
        : fill(t.birthday, base);
      break;
    default:
      return null;
  }
  // No signature line if the agent's name isn't set yet.
  return agent ? text : text.replace(/ – $/, "");
}
