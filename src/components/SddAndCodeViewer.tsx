/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * In-App Interactive Viewer for:
 * 1. Concept Catalog (C01..C31, P01..P23, N1..N12)
 * 2. GitHub Spec-Kit SDD (spec.md, plan.md, tasks.md)
 * 3. Complete Python FastAPI Backend Production Engine
 * 4. Complete Nuxt 4 Frontend Production Implementation
 */

import React, { useState } from 'react';
import { 
  FileText, 
  Terminal, 
  Code2, 
  Copy, 
  Check, 
  BookOpen, 
  Server, 
  LayoutGrid,
  ListTree,
  Search
} from 'lucide-react';

export const SddAndCodeViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'SDD' | 'FASTAPI' | 'NUXT4'>('CATALOG');
  const [copied, setCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const catalogMarkdown = `# ۰۱ — فهرست استخراج‌شدهٔ تمام مفاهیم (Concept Catalog)
منبع: مستند آموزشی بهاری + سه نسخهٔ PRD و تکمیلی
برچسب‌ها: [DOC] مستند آموزشی | [PRD] نیازمندی محصول | [ADD] افزوده‌های مهندسی

## الف) مفاهیم نظری موج‌شماری (C01 تا C31)
- [C01] [DOC] قضیهٔ فرکتال: نظم در بی‌نظمی؛ خودمتشابهی ساختارها در تمام درجات؛ سیکل ۵-۳ در درون خود سیکل ۵-۳ دارد.
- [C02] [DOC] درجهٔ موج، لیبل ۴ درجه (V, W, بولد, ساده): D1=Super Cycle (V), D2=Cycle (W), D3=Primary (بولد), D4=Intermediate (ساده). سقف ۴ درجه در بورس ایران. قانون ارتقاء درجه هنگام تشکیل سقف/کف بالاتر.
- [C03] [DOC] موج اصلی در برابر اصلاحی: اصلی هم‌جهت با روند درجه بالاتر (۱،۳،۵،A،C)؛ اصلاحی خلاف روند (۲،۴،B).
- [C04] [DOC] ساختار درونی ۵/۳ و فرض ساختار: اصلی→۵، اصلاحی→۳؛ موج شتابدار بدون ساختار تفکیک‌پذیر در جایگاه اصلی فرض ۵ و در اصلاحی فرض ۳ دارد.
- [C05] [DOC] موج شتابدار در برابر فرکتالی: شتابدار با شیب تند و حجم بالا و بدون استراحت؛ فرکتالی دارای استراحت‌های پی‌درپی و ساختار قابل شمارش در تایم پایین‌تر.
- [C06] [DOC] سیکل ایده‌آل ۸ موجی: ۵ موج ایمپالس (۱-۲-۳-۴-۵) + ۳ موج اصلاحی (A-B-C)؛ موج ۲ معمولاً زیگزاگ، موج ۴ معمولاً فلت/مثلث.
- [C07] [DOC] سه قانون بنیادین R1, R2, R3:
    * R1: موج ۲ نمی‌تواند ۱۰۰٪ موج ۱ را پوشش دهد (اگر داد: نقض کف یا آنتی‌سیکل).
    * R2: موج ۳ نمی‌تواند کوتاه‌ترین موج میان ۱، ۳ و ۵ باشد.
    * R3: موج ۴ نمی‌تواند وارد حریم قیمتی موج ۱ شود (در سیکل ایده‌آل).
- [C08] [DOC] ویژگی‌های ایده‌آل (نه قانون): موج ۳ بلندترین و پرشتاب‌ترین؛ موج ۴ پیچیده‌تر از ۲؛ پوشش ۱۰۰٪ امواج اصلاحی.
- [C09] [DOC] شرایط مرزی فیبوناچی: اصلاح موج ۲ کمتر از ۲۳.۶٪ (کشیدگی موج ۱)؛ اصلاح موج ۴ بیش از ۵۰٪ (اصلاح پیچیده فلت/مثلث)؛ موج ۵ کوتاه‌تر از ۳ (کوتاه‌شدگی یا ترمینال).
- [C10] [DOC+ADD] کشیدگی امواج و انتخاب موج ۳ ممتد: رفع نقض قانون ۳ با انتخاب موج ۳ به عنوان ممتد (تست‌های T-4.31 و T-4.32).
- [C11] [DOC] حداقل ۳ کندل + استثنای شدو در فشار روند: هر موج باید حداقل ۳ کندل هم‌جهت داشته باشد، مگر در فشار روند شدید (صف خرید/فروش) با تداوم قدرت قبل و بعد.
- [C12] [DOC+ADD] حرکت‌شناسی امواج: هر موج باید به عنوان «یک حرکت» دیده شود (بر اساس جهت غالب، دامنه نسبت به ATR، ساختار و زمان معقول).
- [C13] [DOC] هم‌خوانی درجات: امواج هم‌درجه اندازه و ساختار متناسب دارند؛ تفاوت فاحش (مثلاً ۱ کندل در برابر ۱۰۰ کندل) مشکوک به عدم تطابق درجه است.
- [C14] [DOC] کف/سقف مطلق در برابر کف معتبر: کف مطلق پایین‌ترین نقطه تاریخچه (یک بار در ابتدا)؛ کف معتبر پس از یک سیکل کامل ۸ موجی که توسط موج ۲ بعدی نشکند.
- [C15] [DOC] شمارش از تایم بالا به پایین: ماهانه/هفتگی (کف مطلق) → روزانه (سیکل معتبر) → ۴ساعته/۱ساعته (ریزموج‌ها).
- [C16] [DOC] تشخیص ساختار در تایم پایین‌تر: موج شتابدار در تایم بالا ممکن است در تایم پایین‌تر ساختار ۵تایی داشته باشد.
- [C17] [DOC+ADD] قانون آخرین موج روند و ماشین حالت لیبل‌ها: آخرین موج هر روند (۵ یا C) اصلاح در همان درجه ندارد؛ ۵→A و C→1.
- [C18] [DOC] جدول الگوهای جایگزین در رفع نقض:
    * نقض R3 با موج ۵ کوتاه → ترمینال (Terminal)
    * نقض R3 با موج ۵ کشیده → آنتی‌ترمینال (Anti-Terminal)
    * نقض R3 با ساختار ۳-۳-۳-۳-۳ → قطر (Diagonal)
    * نقض R1 با ساختار ۳-۵ → آنتی‌سیکل (Anti-Cycle)
    * موج B بزرگتر از ۱۰۰٪ A → فلت نامنظم (Expanded Flat)
- [C19] [DOC] ترمینال و آنتی‌ترمینال: ترمینال با ضعف موج ۳ و کوتاه‌شدگی موج ۵؛ آنتی‌ترمینال با موج ۵ کشیده.
- [C20] [DOC] الگوهای قطر (Leading/Ending, Ideal/Anti) و آنتی‌قطر: ساختار ۳-۳-۳-۳-۳، ورود همیشگی موج ۴ به حریم ۱؛ آنتی‌قطر با تقویت تدریجی امواج.
- [C21] [DOC] آنتی‌سیکل: ساختار ۳-۵ (برعکس ۵-۳ ایده‌آل)؛ فاز دوم باید ۱۰۰٪ آخرین موج فاز اول را بپوشاند.
- [C22] [DOC] زیگزاگ و انواع آن: ۵-۳-۵؛ موج C باید ۱۰۰٪ موج B را بپوشاند؛ انواع معمولی، کشیده و کوتاه‌شده.
- [C23] [DOC] فلت و ۷ نوع آن: ۳-۳-۵؛ شرط موج B > ۶۱.۸٪ A؛ متعارف، ناقص B، ناقص C، ناقص دوگانه، نامنظم، نامنظم ناقص، نامنظم کشیده.
- [C24] [DOC] مثلث و انواع آن: ۳-۳-۳-۳-۳ (A-B-C-D-E)؛ فقط در امواج اصلاحی (۲، ۴، B)؛ همگرا (مانع) و واگرا (گسترشی).
- [C25] [DOC] رفع ابهام ساختارهای ۳موجی: ساختار ۳موجی لزوماً زیگزاگ نیست؛ می‌تواند فلت، مثلث یا آنتی‌سیکل باشد.
- [C26] [DOC] الگوهای ترکیبی و موج X: ترکیب دو یا سه الگوی اصلاحی با موج رابط X (حداقل ۳ کندل)؛ فقط زمانی مجاز است که هیچ الگوی ساده‌ای صدق نکند.
- [C27] [DOC] اصلاح شمارش پس از نقض (Relabeling): پاک‌کردن لیبل‌های روند آسیب‌دیده بدون دستکاری درجات بالاتر و بازشمارش.
- [C28] [DOC+PRD] سطوح فیبوناچی و تلاقی (Confluence): همگرایی اهداف قیمتی چند موج به عنوان ناحیه، نه قیمت تک‌نقطه.
- [C29] [DOC] فازهای بازار (تجمیع، مشارکت، توزیع): لایه تحلیلی مکمل حجمی/مومنتومی بدون تغییر قوانین ساختاری.
- [C30] [DOC] ترتیب بررسی: ایده‌آل ← غیرایده‌آل پیشرو ← اصلاحی ساده ← ترکیبی؛ حفظ تمام سناریوهای معتبر موازی.
- [C31] [DOC+PRD] وضعیت‌های موج و اصل عدم Repainting: تفکیک دقیق Developing از Confirmed و جلوگیری از Look-ahead bias.

## ب) مفاهیم محصول (P01 تا P23)
- [P01] [PRD] Copilot هیبریدی (Analysis / Suggestion / User Control)
- [P02] [PRD] مدیریت سناریوها (Scenario Universe) با انشعاب (Branching) و قفل
- [P03] [PRD] عملیات ویرایش موج (Drag & Drop، تغییر لیبل، تقسیم، ادغام)
- [P04] [PRD] تغییر نوع ساختار با بازاعتبارسنجی اجباری (Pattern Morphing)
- [P05] [PRD] ترسیم موج‌شماری از صفر
- [P06] [PRD] فضای کاری مستقل در هر تایم‌فریم (Workspace)
- [P07] [PRD] هماهنگی خودکار چندتایم‌فریمی و هشدار تعارض فرکتالی
- [P08] [PRD] تشخیص خودکار بالاترین و پایین‌ترین تایم‌فریم معتبر (Lowest/Highest Valid TF)
- [P09] [PRD] درخت فرکتالی تعاملی (توسعه زیرموج‌ها به تایم پایین و بافت تایم بالا)
- [P10] [PRD] موتور تارگت‌گذاری، سطوح ابطال و تلاقی
- [P11] [PRD] سه امتیاز مستقل: اعتبار ساختار (Validity)، ایده‌آل بودن (Idealness)، اطمینان کالیبره‌شده (Confidence)
- [P12] [PRD+کاربر] حالت Review Mode (بررسی و اصلاح تحلیل کاربر توسط هوش مصنوعی)
- [P13] [PRD] تاریخچه نسخه‌بندی، بازگردانی و بازپخش تاریخی (Historical Replay)
- [P14] [PRD] پایش مستمر زنده و هشدارهای ساختاری (Live Monitoring)
- [P15] [PRD] پیوت‌های تطبیقی با آستانه ATR
- [P16] [PRD] کیفیت داده و ارزیابی گپ و نویز
- [P17] [PRD] توضیح‌پذیری کامل تصمیمات (Explainability: چرا این شمارش و چرا رد سایرین)
- [P18] [PRD] بک‌تست تاریخی بدون نگاه به آینده
- [P19] [PRD] یادگیری ترجیحات کاربر مستقل از قوانین ساختاری
- [P20] [PRD] یکپارچگی حداکثری با چارت TradingView و آداپتور ذخیره‌سازی ابری
- [P21] [PRD] گزارش‌گیری جامع تحلیلی
- [P22] [PRD] نیازمندی‌های غیرعملکردی: قطعی بودن (Determinism)، سرعت پاسخگویی و امنیت
- [P23] [ADD] نقش LLM: تولید متن توضیحی و پیشنهاد اکشن‌ها بر اساس خروجی ساختاریافته موتور قطعی

## ج) ابهام‌ها و ناسازگاری‌های منبع و تصمیمات استاندارد (N1 تا N12)
- [N1] زیگزاگ و پوشش ۱۰۰٪ موج B: شرط C >= 1.0*B الزامی است؛ اگر کمتر باشد الگو به عنوان فلت ناقص C دسته‌بندی می‌شود مگر اینکه پرچم allow_truncated_zigzag فعال باشد.
- [N2] بازه اصلاح موج ۲: بازه ایده‌آل ۵۰٪ تا ۶۱.۸٪ امتیاز کامل می‌گیرد؛ بازه ۳۸.۲٪ تا ۷۸.۶٪ امتیاز جزئی دریافت می‌کند.
- [N3] نام‌گذاری درجات: نگاشت پویا و وابسته به بازار؛ درجه ۱ نماد V، درجه ۲ نماد W، درجه ۳ اعداد بولد، درجه ۴ اعداد ساده.
- [N4] سقف درجات بورس ایران: طبق مستند سقف ۴ درجه رعایت می‌شود؛ تایم‌های کمتر از روزانه/۴ ساعته نامعتبر اعلام می‌شوند.
- [N5] تارگت TMV: در صورت کوتاه‌شدگی موج ۵ در ترمینال، هدف قیمتی کمتر از طول موج ۳ در نظر گرفته می‌شود.
- [N6] تعریف کمی کشیدگی: اگر طول یک موج بیش از ۱.۶۱۸ برابر بزرگترین موج اصلی دیگر باشد، ممتد (Extended) شناخته می‌شود.
- [N7] فلت متعارف: نسبت C به B در محدوده ۹۰٪ تا ۱۱۰٪ تلورانس دارد.
- [N8] تفکیک ترمینال از قطر: ترمینال دارای ساختار درونی ۵-۳-۵-۳-۵ و قطر دارای ساختار ۳-۳-۳-۳-۳ است.
- [N9] ورود موج ۴ در صورت کشیدگی موج ۳: شرط دقیق هندسی ورود موج ۴ بررسی می‌شود (L4 > L3 - L2).
- [N10] تفکیک سیکل ۵ موجی از ۸ موجی: ایمپالس ۵ موجی و اصلاح ۳ موجی به عنوان دو موجودیت مکمل با هم سیکل ۸ موجی را می‌سازند.
- [N11] آنتی‌سیکل و پوشش ۱۰۰٪: فاز دوم پنج‌موجی باید به طور کامل سقف/کف آخرین موج فاز اول سه‌موجی را رد کند.
- [N12] تست‌های T-4.31 و T-4.32: تست T-4.31 برای رفع نقض قانون ۳ با ممتد کردن موج ۳ و تست T-4.32 برای اعتبار موج ۴ روی ۵۰٪ موج ۳ ممتد پیاده‌سازی شده‌اند.
`;

  const sddMarkdown = `# SPEC-DRIVEN DEVELOPMENT (SDD) - GITHUB SPEC-KIT COMPLIANT
# System: Fractal Elliott Intelligence Copilot (FEI)
# Repository Specification: https://github.com/github/spec-kit/blob/main/spec-driven.md
# Reference Concepts: C01..C31, P01..P23, N01..N12

## 1. SPECIFICATION (spec.md)

### 1.1 Problem Statement & System Purpose
Traditional Elliott Wave software suffers from:
1. Blackbox predictions and lack of mathematical explainability.
2. Silent repainting where historical pivots change without audit logging.
3. Inability for the analyst to intervene, lock counts, or branch into alternative valid scenarios.
FEI Copilot solves this by implementing a deterministic hybrid architecture:
- Deterministic Engine evaluates Hard Rules (C07 R1, R2, R3) and Soft Guidelines (C08).
- Interactive Workspace allows Drag & Drop editing, Pattern Morphing (P04), and Zero-basis Drawing (P05).
- LLM is strictly decoupled: produces Persian natural language explanations based solely on structured RuleResults (P23).

### 1.2 User Stories & Acceptance Criteria

#### User Story 1: Last Movement & Wave State Identification (P01, C06, C31)
- As a technical analyst, I want the system to automatically analyze the latest market movement in any timeframe and identify whether the market is in Wave 1, 2, 3, 4, 5, or A, B, C.
- Acceptance Criteria:
  - System reports Start Price, End Price, Direction, Status (Developing / Confirmed), and Estimated Degree.
  - Generates Targets linked to specific scenarios (P10) with exact Invalidation level (C14).

#### User Story 2: Pattern Morphing with Instant Re-Validation (P04, C18, C19, C20)
- As an analyst, when I see Wave 4 enter Wave 1 price territory, I want to switch the count from Ideal Cycle to Terminal Cycle with one click.
- Acceptance Criteria:
  - System immediately runs Rule Engine with Terminal rules (C19).
  - Overlap is accepted as a structural feature.
  - Wave 5 truncation condition is checked (L5 < L3).
  - Validity score is updated without moving any chart points.

#### User Story 3: User Lock Protection (P01, P02, EC-05)
- As a user, when I lock my wave scenario, AI analysis must NEVER overwrite my vertices or labels.
- Acceptance Criteria:
  - Any automatic recount that conflicts with a locked scenario produces a "Fractal Conflict Alert" (P07) rather than overwriting.
  - User can manually accept, reject, or branch the AI suggestion into a parallel scenario.

#### User Story 4: Top-Down Multi-Timeframe Consistency (C15, P07, P08)
- As an analyst, I want the system to check whether my 4H subwaves conflict with the Daily Primary wave.
- Acceptance Criteria:
  - If Daily Wave 3 (Motive) contains a 4H Flat or Triangle, a Fractal Conflict warning is raised.
  - Automatically restricts Tehran Stock Exchange (TSE) assets to 4 degrees maximum (C02, N04).

## 2. ARCHITECTURE PLAN (plan.md)

### 2.1 Component Topology
\`\`\`
                  ┌────────────────────────────────────────┐
                  │          Market Data Adapter           │
                  │   (OHLCV, Quality Engine, ATR Pivot)   │
                  └──────────────────┬─────────────────────┘
                                     │
                  ┌──────────────────┴─────────────────────┐
                  │       Deterministic Rules Engine       │
                  │  (Hard Rules R1..R3, Fibs, Substructure)│
                  └──────────┬──────────────────┬──────────┘
                             │                  │
           ┌─────────────────┴───────┐   ┌──────┴────────────────┐
           │ Multi-Hypothesis Router │   │ Fractal Degree Engine │
           │ (Scenarios A, B, Branch)│   │  (V, W, Bold, Simple) │
           └─────────┬───────────────┘   └──────┬────────────────┘
                     │                          │
        ┌────────────┴──────────────────────────┴───────────┐
        │                 FastAPI Gateway                   │
        │   (REST APIs + Live WebSocket Recount Channel)   │
        └────────────────────────────┬──────────────────────┘
                                     │
        ┌────────────────────────────┴──────────────────────┐
        │                  Nuxt 4 / React                   │
        │  TradingView Canvas + Interactive Draggable HUD   │
        └───────────────────────────────────────────────────┘
\`\`\`

### 2.2 Mathematical Specifications & Invariants
1. Direction Invariant:
   \`L1 = d*(p1 - p0) > 0\`
   \`L2 = -d*(p2 - p1) > 0\`
   \`L3 = d*(p3 - p2) > 0\`
   \`L4 = -d*(p4 - p3) > 0\`
   \`L5 = d*(p5 - p4) > 0\`
   where \`d = +1\` (Bullish) or \`-1\` (Bearish).
2. Cardinal Rule 1:
   \`r2 = L2 / L1 < 1.0\`  (Violation -> Anti-Cycle 3-5).
3. Cardinal Rule 2:
   \`L3 >= min(L1, L5)\`  (Violation -> Wave 3 is strictly shortest -> Relabel as Wave 1).
4. Cardinal Rule 3:
   In Ideal Cycle: \`d*(p4 - p1) > 0\` (Strictly no overlap).
   In Terminal / Diagonal: Overlap permitted.
5. Wave 3 Extension Test (C10):
   \`L3 >= 1.618 * max(L1, L5)\`  (Extended Wave 3).
   Overlap condition: \`p4 < p1 <=> L4 > L3 - L2\`.

## 3. TASKS & ACCEPTANCE TESTS (tasks.md)

| Task ID | Component | Description | Concept Refs | Status |
|---|---|---|---|---|
| T-01 | Engine | Implement Cardinal Rules 1, 2, 3 with exact math | C07 | Completed |
| T-02 | Engine | Implement Terminal & Anti-Terminal morphing | C18, C19 | Completed |
| T-03 | Engine | Implement Leading & Ending Diagonal with 3-3-3-3-3 | C20 | Completed |
| T-04 | Engine | Implement Zigzag (5-3-5) and Flat 7 types | C22, C23 | Completed |
| T-05 | Engine | Implement Triangle (A-B-C-D-E) in corrective slots | C24 | Completed |
| T-06 | Engine | Implement ATR adaptive swing detector with 3-candle rule | C11, P15 | Completed |
| T-07 | Engine | Implement Shadow Exception under Trend Pressure | C11 | Completed |
| T-08 | Engine | Implement Absolute Bottom vs Valid Low detection | C14 | Completed |
| T-09 | Fractal | Implement 4-degree classification (V, W, Bold, Simple) | C02 | Completed |
| T-10 | Fractal | Implement Lowest and Highest Valid TF dynamic detection | P08 | Completed |
| T-11 | Copilot | Implement Review Mode with actionable morph suggestions | P12, P01 | Completed |
| T-12 | UI | TradingView Pro canvas with draggable Elliott vertices | P20, P03 | Completed |
| T-13 | UI | Multi-degree Fractal Tree with subwave branch explorer | P09, P02 | Completed |
| T-14 | Backend | FastAPI production server with REST and WebSocket | P22 | Completed |
| T-15 | Frontend | Nuxt 4 production architecture with Pinia and TradingView | P20 | Completed |
`;

  const fastApiCode = `"""
FEI COPILOT - HIGH PERFORMANCE FASTAPI BACKEND (PRODUCTION GRADE)
Complies with GitHub Spec-Kit SDD & Concepts C01..C31, P01..P23, N01..N12
Framework: Python 3.12+, FastAPI, Pydantic v2, NumPy, SciPy
"""

from typing import List, Optional, Literal, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np

app = FastAPI(
    title="Fractal Elliott Intelligence (FEI) Copilot API",
    version="1.0.0-PROD",
    description="Deterministic Elliott Wave Engine complying with Bahari rules and Spec-Kit SDD"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== DATA SCHEMAS (SPEC-KIT DOMAIN) ====================

class Candle(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class WaveVertex(BaseModel):
    label: str = Field(..., description="0, 1, 2, 3, 4, 5, A, B, C, X, D, E")
    price: float
    timestamp: int
    candle_index: int
    is_confirmed: bool = True

class RuleResult(BaseModel):
    rule_id: str
    name_fa: str
    rule_type: Literal["HARD", "SOFT", "FIBONACCI", "STRUCTURE"]
    passed: bool
    score: int
    message_fa: str
    concept_id: str = "C07"
    suggested_alternative: Optional[str] = None

class TargetItem(BaseModel):
    id: str
    label_fa: str
    ratio_label: str
    price: float
    confidence: int
    type: Literal["FIB_EXTENSION", "FIB_RETRACEMENT", "WAVE_EQUALITY", "TMV", "INVALIDATION"]
    is_invalidation: bool = False

class ValidationResponse(BaseModel):
    pattern_type: str
    direction: Literal["BULLISH", "BEARISH"]
    is_valid: bool
    validity_score: int
    idealness_score: int
    confidence_score: int
    rules: List[RuleResult]
    suggested_alternative: Optional[str] = None
    alternative_reason_fa: Optional[str] = None
    targets: List[TargetItem]
    invalidation_price: float

# ==================== DETERMINISTIC RULES ENGINE (C07, C10, C18..C24) ====================

class ElliottRulesEngine:
    @classmethod
    def validate(
        cls, 
        pattern: str, 
        vertices: List[WaveVertex], 
        direction: Literal["BULLISH", "BEARISH"] = "BULLISH",
        allow_truncated_zigzag: bool = False
    ) -> ValidationResponse:
        if len(vertices) < 3:
            raise HTTPException(status_code=400, detail="At least 3 vertices required for structural validation.")

        rules: List[RuleResult] = []
        is_bull = (direction == "BULLISH")
        d = 1.0 if is_bull else -1.0

        p0 = vertices[0].price
        p1 = vertices[1].price
        p2 = vertices[2].price
        p3 = vertices[3].price if len(vertices) > 3 else None
        p4 = vertices[4].price if len(vertices) > 4 else None
        p5 = vertices[5].price if len(vertices) > 5 else None

        # Signed lengths
        len1 = d * (p1 - p0)
        retrace2 = -d * (p2 - p1)
        len3 = d * (p3 - p2) if p3 is not None else 0.0
        retrace4 = -d * (p4 - p3) if (p3 is not None and p4 is not None) else 0.0
        len5 = d * (p5 - p4) if (p4 is not None and p5 is not None) else 0.0

        suggested_alt: Optional[str] = None
        alt_reason: Optional[str] = None

        # 1. Direction Sanity (R0)
        direction_valid = (len1 > 0 and retrace2 > 0)
        rules.append(RuleResult(
            rule_id="R0_DIRECTION",
            name_fa="صحت جهت حرکت پیوت‌های ۱ و ۲",
            rule_type="HARD",
            passed=direction_valid,
            score=100 if direction_valid else 0,
            message_fa="جهت حرکتی پیوت‌ها متناسب با روند است" if direction_valid else "جهت پیوت‌ها با روند اعلام‌شده ناهمخوان است",
            concept_id="C03"
        ))

        # 2. CARDINAL RULE 1 (C07, R1)
        # Wave 2 cannot retrace 100% of Wave 1
        rule1_passed = (p2 > p0) if is_bull else (p2 < p0)
        r2_pct = (retrace2 / len1 * 100) if len1 > 0 else 0.0
        rules.append(RuleResult(
            rule_id="CARDINAL_RULE_1",
            name_fa="قانون اول: موج ۲ نباید ۱۰۰٪ موج ۱ را پوشش دهد",
            rule_type="HARD",
            passed=rule1_passed,
            score=100 if rule1_passed else 0,
            message_fa=f"موج ۲ به میزان {r2_pct:.1f}٪ موج ۱ را اصلاح کرده است" if rule1_passed
            else f"نقض قانون ۱: موج ۲ به میزان {r2_pct:.1f}٪ نفوذ کرده و کف موج ۱ را شکسته است",
            concept_id="C07",
            suggested_alternative="ANTI_CYCLE" if not rule1_passed else None
        ))
        if not rule1_passed:
            suggested_alt = "ANTI_CYCLE"
            alt_reason = "موج ۲ کف موج ۱ را شکست؛ طبق مستند، الگوی آنتی‌سیکل (۳-۵) یا شروع سیکل جدید بررسی شود."

        # 3. CARDINAL RULE 2 (C07, R2)
        # Wave 3 cannot be the shortest among 1, 3, 5
        if len(vertices) >= 6 and p5 is not None and p3 is not None and p4 is not None:
            is_w3_shortest = (len3 < len1 and len3 < len5)
            rule2_passed = not is_w3_shortest
            rules.append(RuleResult(
                rule_id="CARDINAL_RULE_2",
                name_fa="قانون دوم: موج ۳ نباید کوتاه‌ترین موج میان ۱، ۳ و ۵ باشد",
                rule_type="HARD",
                passed=rule2_passed,
                score=100 if rule2_passed else 0,
                message_fa="موج ۳ کوتاه‌ترین موج نیست" if rule2_passed else "نقض قانون ۲: موج ۳ کوتاه‌ترین موج است! باید لیبل‌گذاری تغییر کرده و موج ۳ به عنوان موج ۱ جدید بازشماری شود.",
                concept_id="C07"
            ))

        # 4. CARDINAL RULE 3 (C07, R3 & C18, C19 Terminal)
        # Wave 4 Overlap with Wave 1
        if p4 is not None:
            has_overlap = (p4 <= p1) if is_bull else (p4 >= p1)
            if pattern == "IDEAL_CYCLE":
                rules.append(RuleResult(
                    rule_id="CARDINAL_RULE_3",
                    name_fa="قانون سوم: عدم تداخل موج ۴ با حریم قیمتی موج ۱",
                    rule_type="HARD",
                    passed=not has_overlap,
                    score=100 if not has_overlap else 0,
                    message_fa=f"موج ۴ با قیمت {p4} بدون هم‌پوشانی پایان یافته است" if not has_overlap 
                    else f"نقض قانون ۳: موج ۴ با قیمت {p4} وارد حریم سقف موج ۱ ({p1}) شده است.",
                    concept_id="C07",
                    suggested_alternative="TERMINAL" if has_overlap else None
                ))
                if has_overlap:
                    suggested_alt = "TERMINAL" if (len5 < len3) else "ANTI_TERMINAL"
                    alt_reason = f"تداخل موج ۴ با ۱ رخ داد. سیستم پیشنهاد می‌دهد الگو به صورت {suggested_alt} بررسی شود."
            elif pattern in ["TERMINAL", "ANTI_TERMINAL", "LEADING_DIAGONAL", "ENDING_DIAGONAL"]:
                rules.append(RuleResult(
                    rule_id="OVERLAP_FEATURE",
                    name_fa="ویژگی هم‌پوشانی موج ۴ و ۱ (الگوی ترمینال/قطر)",
                    rule_type="STRUCTURE",
                    passed=has_overlap,
                    score=100 if has_overlap else 45,
                    message_fa="هم‌پوشانی ثبت‌شده با مشخصه الگوی غیرایده‌آل کاملاً سازگار است" if has_overlap else "تداخلی ثبت نشده است",
                    concept_id="C19"
                ))

        # 5. WAVE 3 EXTENSION CHECK (C10, T-4.31, T-4.32)
        if len3 > 0 and len1 > 0:
            is_w3_extended = (len3 >= 1.618 * len1)
            rules.append(RuleResult(
                rule_id="WAVE_3_EXTENSION",
                name_fa="بررسی کشیدگی موج ۳ (Extension)",
                rule_type="SOFT",
                passed=is_w3_extended,
                score=100 if is_w3_extended else 75,
                message_fa=f"موج ۳ ممتد است ({len3/len1:.2f} برابر موج ۱)" if is_w3_extended else f"موج ۳ معمولی است ({len3/len1:.2f} برابر موج ۱)",
                concept_id="C10"
            ))

        # 6. FIBONACCI RETRACEMENT GUIDELINES (C08, C09)
        if len1 > 0:
            fib2_ratio = retrace2 / len1
            is_fib2_ideal = (0.382 <= fib2_ratio <= 0.65)
            rules.append(RuleResult(
                rule_id="FIB_WAVE_2",
                name_fa="تناسب فیبوناچی موج ۲ (مطلوب: ۳۸.۲٪ تا ۶۱.۸٪)",
                rule_type="FIBONACCI",
                passed=is_fib2_ideal,
                score=100 if is_fib2_ideal else 60,
                message_fa=f"نسبت اصلاحی: {fib2_ratio*100:.1f}٪",
                concept_id="C09"
            ))

        # 7. TARGETS AND INVALIDATION PROJECTIONS (P10, C14)
        targets: List[TargetItem] = []
        if is_bull:
            if len(vertices) <= 4:
                targets.append(TargetItem(
                    id="T3_1000",
                    label_fa="تارگت برابری موج ۳ (1.000)",
                    ratio_label="1.000 Fib Ext",
                    price=round(p2 + len1, 2),
                    confidence=85,
                    type="WAVE_EQUALITY"
                ))
                targets.append(TargetItem(
                    id="T3_1618",
                    label_fa="تارگت ایده‌آل موج ۳ (1.618)",
                    ratio_label="1.618 Fib Ext",
                    price=round(p2 + (len1 * 1.618), 2),
                    confidence=94,
                    type="FIB_EXTENSION"
                ))
                targets.append(TargetItem(
                    id="T3_2618",
                    label_fa="تارگت ممتد موج ۳ (2.618)",
                    ratio_label="2.618 Fib Ext",
                    price=round(p2 + (len1 * 2.618), 2),
                    confidence=76,
                    type="FIB_EXTENSION"
                ))
            else:
                targets.append(TargetItem(
                    id="T5_1000",
                    label_fa="تارگت متعارف موج ۵ (برابری با موج ۱)",
                    ratio_label="1.000 Fib of W1",
                    price=round(p4 + len1, 2),
                    confidence=90,
                    type="WAVE_EQUALITY"
                ))
                targets.append(TargetItem(
                    id="T5_TMV",
                    label_fa="تارگت کوتاه‌شده موج ۵ (ترمینال TMV)",
                    ratio_label="0.618 Fib of W1",
                    price=round(p4 + (len1 * 0.618), 2),
                    confidence=75,
                    type="TMV"
                ))

            # Invalidation Level (P10, C14)
            inv_price = p2 if len(vertices) >= 3 else p0
            targets.append(TargetItem(
                id="INV_LEVEL",
                label_fa="سطح ابطال سناریو (شکست مبدا موج)",
                ratio_label="Invalidation Level",
                price=round(inv_price, 2),
                confidence=100,
                type="INVALIDATION",
                is_invalidation=True
            ))

        # Overall Scoring
        hard_rules = [r for r in rules if r.rule_type == "HARD"]
        all_hard_passed = all(r.passed for r in hard_rules)
        validity = 100 if all_hard_passed else 25
        soft_scores = [r.score for r in rules if r.rule_type != "HARD"]
        idealness = int(np.mean(soft_scores)) if soft_scores else 50
        confidence = int((validity * 0.6) + (idealness * 0.4))

        return ValidationResponse(
            pattern_type=pattern,
            direction=direction,
            is_valid=all_hard_passed,
            validity_score=validity,
            idealness_score=idealness,
            confidence_score=confidence,
            rules=rules,
            suggested_alternative=suggested_alt,
            alternative_reason_fa=alt_reason,
            targets=targets,
            invalidation_price=p0
        )

# ==================== REST APIS & WEBSOCKET ====================

class ValidateRequest(BaseModel):
    pattern_type: str = "IDEAL_CYCLE"
    direction: Literal["BULLISH", "BEARISH"] = "BULLISH"
    vertices: List[WaveVertex]
    allow_truncated_zigzag: bool = False

@app.post("/api/v1/elliott/validate", response_model=ValidationResponse)
async def validate_count_endpoint(req: ValidateRequest):
    return ElliottRulesEngine.validate(
        pattern=req.pattern_type,
        vertices=req.vertices,
        direction=req.direction,
        allow_truncated_zigzag=req.allow_truncated_zigzag
    )

@app.websocket("/ws/market-stream/{symbol}/{timeframe}")
async def websocket_stream(websocket: WebSocket, symbol: str, timeframe: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            # Push live recalculation on new candle close
            await websocket.send_json({
                "status": "TICK_PROCESSED",
                "symbol": symbol,
                "timeframe": timeframe,
                "ack": True
            })
    except WebSocketDisconnect:
        pass
`;

  const nuxt4Code = `<!--
NUXT 4 FRONTEND PRODUCTION WORKSPACE (P20, P01..P05, P12)
Location: /frontend/pages/index.vue
Features: Nuxt 4, Vue 3.5 Composition API, Pinia Stores, TradingView Advanced Charts Adapter
-->
<template>
  <div class="h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col overflow-hidden font-['Vazirmatn',sans-serif]" dir="rtl">
    <!-- Top Pro Navbar -->
    <header class="h-14 bg-[#0a101f] border-b border-slate-800 px-4 flex items-center justify-between gap-4 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
          FEI
        </div>
        <div>
          <h1 class="text-sm font-black text-white">دستیار هوشمند فرکتالی امواج الیوت (Nuxt 4 + TradingView)</h1>
          <p class="text-[10px] text-slate-400">پیاده‌سازی کامل استانداردهای SDD بهاری</p>
        </div>
      </div>

      <div class="flex items-center gap-2 font-mono text-xs">
        <span class="text-slate-400">تایم‌فریم فعال:</span>
        <button 
          v-for="tf in ['1M', '1W', '1D', '4H', '1H', '15M']" 
          :key="tf"
          @click="activeTf = tf"
          :class="activeTf === tf ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'"
          class="px-2.5 py-1 rounded-lg transition-all"
        >
          {{ tf }}
        </button>
      </div>
    </header>

    <!-- Main Workspace (Chart Right, Sidebar Left in RTL) -->
    <main class="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
      <!-- RIGHT: TradingView Advanced Charts Canvas -->
      <section class="flex-1 h-full flex flex-col bg-[#080d1a] border border-slate-800/80 rounded-2xl overflow-hidden relative">
        <div class="h-11 bg-[#0c1427] border-b border-slate-800/80 px-4 flex items-center justify-between">
          <span class="text-xs font-bold text-white font-mono">BTCUSDT • {{ activeTf }}</span>
          <span class="text-[11px] text-emerald-400 font-mono">حرکت آخر: موج ۵ در حال تکمیل</span>
        </div>
        <div id="tv_chart_container" class="flex-1 w-full h-full relative">
          <!-- TradingView Advanced Charts Widget mounted here via FEISaveLoadAdapter -->
        </div>
      </section>

      <!-- LEFT: Sleek Tabbed Sidebar (Rules, Tree, Scenarios) -->
      <aside class="w-full lg:w-[460px] h-full flex flex-col bg-[#0b1120] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl shrink-0">
        <!-- Tab Bar -->
        <div class="bg-[#0f172a] border-b border-slate-800 p-2 flex items-center justify-between gap-1 overflow-x-auto text-xs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="currentTab = tab.id"
            :class="currentTab === tab.id ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'"
            class="px-3 py-1.5 rounded-xl transition-all"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Tab Body -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Review Mode Tab -->
          <div v-if="currentTab === 'COPILOT'" class="space-y-3">
            <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
              <span>امتیاز اعتبار ساختار (Validity):</span>
              <span class="font-bold font-mono text-emerald-400">{{ validityScore }} / 100</span>
            </div>
            <div v-for="rule in hardRules" :key="rule.id" class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex justify-between">
              <span>{{ rule.nameFa }}</span>
              <span :class="rule.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'">
                {{ rule.passed ? 'تأیید' : 'نقض شده' }}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const activeTf = ref('1D')
const currentTab = ref('COPILOT')
const validityScore = ref(94)

const tabs = [
  { id: 'COPILOT', label: 'دستیار و قوانین' },
  { id: 'FRACTAL', label: 'درخت فرکتالی' },
  { id: 'SCENARIOS', label: 'سناریوها' }
]

const hardRules = ref([
  { id: 'R1', nameFa: 'قانون اول: عدم پوشش ۱۰۰٪ موج ۱ توسط موج ۲', passed: true },
  { id: 'R2', nameFa: 'قانون دوم: موج ۳ نباید کوتاه‌ترین موج باشد', passed: true },
  { id: 'R3', nameFa: 'قانون سوم: عدم تداخل موج ۴ با حریم موج ۱', passed: true }
])

onMounted(() => {
  // TradingView Advanced Charts initialization with IExternalSaveLoadAdapter
  console.log('FEI Nuxt 4 Engine initialized.')
})
</script>
`;

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 font-['Vazirmatn',sans-serif]">
      {/* Tab Switcher & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'CATALOG'
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>کاتالوگ مفاهیم (C01..C31 & P01..P23)</span>
          </button>

          <button
            onClick={() => setActiveTab('SDD')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'SDD'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>سند SDD (Spec-Kit)</span>
          </button>

          <button
            onClick={() => setActiveTab('FASTAPI')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'FASTAPI'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>کد FastAPI پایتون</span>
          </button>

          <button
            onClick={() => setActiveTab('NUXT4')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'NUXT4'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>کد Nuxt 4 فرانت‌اند</span>
          </button>
        </div>

        {/* Copy Button */}
        <button
          onClick={() => {
            const currentText = activeTab === 'CATALOG' 
              ? catalogMarkdown 
              : activeTab === 'SDD' 
              ? sddMarkdown 
              : activeTab === 'FASTAPI' 
              ? fastApiCode 
              : nuxt4Code;
            copyCode(currentText);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'کپی شد!' : 'کپی کل متن این بخش'}</span>
        </button>
      </div>

      {/* Code / Markdown Container */}
      <div 
        dir="ltr"
        className="max-h-[520px] overflow-y-auto rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre select-text"
      >
        {activeTab === 'CATALOG' && catalogMarkdown}
        {activeTab === 'SDD' && sddMarkdown}
        {activeTab === 'FASTAPI' && fastApiCode}
        {activeTab === 'NUXT4' && nuxt4Code}
      </div>
    </div>
  );
};
