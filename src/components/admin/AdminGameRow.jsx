import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { qLabel, formatDate, getLatestTime, getGameInfo, displayName } from "../../utils/game";



export default AdminGameRow;