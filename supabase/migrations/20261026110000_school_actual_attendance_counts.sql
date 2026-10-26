-- Actual school attendance is independent of booked headcounts.
-- Preserve booking requirements, physical capacity, permissions, audit and retries.
DO $$
DECLARE
 target regprocedure;
 definition text;
 before_text text;
 after_text text;
BEGIN
 target := 'public.reception_panel_check_in(text,uuid,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)'::regprocedure;
 definition := pg_get_functiondef(target);
 before_text := 'p_students>expected_students or p_companions>expected_companions';
 after_text := 'p_students>1000 or p_companions>100';
 IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'Unexpected school Forum validation'; END IF;
 definition := replace(definition,before_text,after_text);
 before_text := 'expected_students:=least(reservation_students,b.student_count,coalesce(arrival.student_count,reservation_students));';
 IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'Unexpected school student reference'; END IF;
 definition := replace(definition,before_text,'expected_students:=reservation_students;');
 before_text := 'expected_companions:=least(reservation_companions,b.companion_count,coalesce(arrival.companion_count,reservation_companions));';
 IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'Unexpected school companion reference'; END IF;
 definition := replace(definition,before_text,'expected_companions:=reservation_companions;');
 EXECUTE definition;

 -- Some local upgrade tests install the manager wrapper after legacy checks.
 target := coalesce(to_regprocedure('app.reception_check_in_core(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)'),
   'public.reception_check_in(uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text)'::regprocedure);
 definition := pg_get_functiondef(target);
 before_text := 'p_students>b.student_count or p_companions>b.companion_count';
 IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'Unexpected school event validation'; END IF;
 EXECUTE replace(definition,before_text,after_text);
END $$;
