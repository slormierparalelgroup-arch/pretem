update public.loans l
set
  destination_country = coalesce(l.destination_country, p.country, 'haiti'),
  currency = coalesce(
    l.currency,
    case lower(coalesce(l.destination_country, p.country, 'haiti'))
      when 'usa' then 'USD'
      when 'mexico' then 'MXN'
      else 'HTG'
    end
  ),
  phone = coalesce(nullif(l.phone, ''), p.phone, l.phone),
  full_name = coalesce(nullif(l.full_name, ''), p.full_name, l.full_name),
  repayment_review_status = case
    when l.status = 'paid' and coalesce(l.repayment_review_status, 'not_submitted') = 'not_submitted' then 'accepted'
    else coalesce(l.repayment_review_status, 'not_submitted')
  end,
  repayment_pause_status = coalesce(l.repayment_pause_status, 'none'),
  payout_details = coalesce(l.payout_details, '{}'::jsonb),
  paid_at = case
    when l.status = 'paid' then coalesce(l.paid_at, l.repayment_submitted_at, l.due_date, l.created_at)
    else l.paid_at
  end,
  repayment_submitted_at = case
    when l.status = 'paid' then coalesce(l.repayment_submitted_at, l.paid_at, l.due_date, l.created_at)
    else l.repayment_submitted_at
  end,
  rejected_at = case
    when l.status = 'rejected' then coalesce(l.rejected_at, l.created_at)
    else l.rejected_at
  end
from public.profiles p
where p.id = l.user_id;

update public.loans l
set
  disbursed_at = coalesce(l.disbursed_at, l.created_at),
  due_date = coalesce(l.due_date, coalesce(l.disbursed_at, l.created_at) + make_interval(days => coalesce(l.repayment_days, 7)))
where l.status in ('approved', 'paid')
  and (l.disbursed_at is not null or l.disbursement_transfer_id is not null or l.status = 'paid');
