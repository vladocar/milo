// Milo 0.3: C++17 bytecode VM and reference tree interpreter. See ../LICENSE.
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <functional>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <variant>
#include <vector>
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#endif

namespace milo {
using I = std::int64_t;
struct Error : std::runtime_error {
    int line;
    explicit Error(std::string message, int source_line = 0)
        : std::runtime_error(std::move(message)), line(source_line) {}
};
struct List; struct Dict; struct Function; struct Env; struct Code; struct VMEnv;
struct Range { I start, stop, step; }; // inclusive stop
struct Builtin { std::string name; };
struct Value {
    using Data = std::variant<std::monostate, bool, I, double, std::string,
        std::shared_ptr<List>, std::shared_ptr<Dict>, Range, std::shared_ptr<Function>, Builtin>;
    Data data;
    Value() = default;
    template<class T> explicit Value(T v) : data(std::move(v)) {}
    template<class T> bool is() const { return std::holds_alternative<T>(data); }
    template<class T> const T& get() const { return std::get<T>(data); }
};
struct List { std::vector<Value> values; };
struct Dict { std::vector<std::pair<Value, Value>> values; };
constexpr I IMIN = std::numeric_limits<I>::min(), IMAX = std::numeric_limits<I>::max();

// Decode UTF-8 once per text operation; index/count by Unicode code points, not bytes.
std::vector<std::string> characters(const std::string& s) {
    std::vector<std::string> out;
    for (std::size_t i = 0; i < s.size();) {
        const auto c = static_cast<unsigned char>(s[i]);
        std::size_t n = c < 0x80 ? 1 : c < 0xE0 ? 2 : c < 0xF0 ? 3 : 4;
        if ((c >= 0x80 && c < 0xC2) || c > 0xF4 || i + n > s.size())
            throw Error("Invalid UTF-8 text.");
        std::uint32_t point = c & (n == 1 ? 0x7F : n == 2 ? 0x1F : n == 3 ? 0x0F : 0x07);
        for (std::size_t j = 1; j < n; ++j) {
            auto tail = static_cast<unsigned char>(s[i+j]);
            if ((tail & 0xC0) != 0x80) throw Error("Invalid UTF-8 text.");
            point = (point << 6) | (tail & 0x3F);
        }
        if ((n == 2 && point < 0x80) || (n == 3 && point < 0x800) ||
            (n == 4 && point < 0x10000) || point > 0x10FFFF || (point >= 0xD800 && point <= 0xDFFF))
            throw Error("Invalid UTF-8 text.");
        out.push_back(s.substr(i, n)); i += n;
    }
    return out;
}
std::string utf8(std::uint32_t cp) {
    if (cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) throw Error("Invalid Unicode escape.");
    std::string s;
    if (cp < 0x80) s += static_cast<char>(cp);
    else if (cp < 0x800) { s += static_cast<char>(0xC0 | (cp >> 6)); s += static_cast<char>(0x80 | (cp & 63)); }
    else if (cp < 0x10000) { s += static_cast<char>(0xE0 | (cp >> 12)); s += static_cast<char>(0x80 | ((cp >> 6) & 63)); s += static_cast<char>(0x80 | (cp & 63)); }
    else { s += static_cast<char>(0xF0 | (cp >> 18)); s += static_cast<char>(0x80 | ((cp >> 12) & 63)); s += static_cast<char>(0x80 | ((cp >> 6) & 63)); s += static_cast<char>(0x80 | (cp & 63)); }
    return s;
}
I checked_add(I x, I y) {
    if ((y > 0 && x > IMAX-y) || (y < 0 && x < IMIN-y)) throw Error("Integer overflow (64-bit limit).");
    return x+y;
}
I checked_sub(I x, I y) {
    if ((y < 0 && x > IMAX+y) || (y > 0 && x < IMIN+y)) throw Error("Integer overflow (64-bit limit).");
    return x-y;
}
I checked_mul(I x, I y) {
    if (x == 0 || y == 0) return 0;
    if ((x == -1 && y == IMIN) || (y == -1 && x == IMIN)) throw Error("Integer overflow (64-bit limit).");
    if (x > 0 ? (y > 0 ? x > IMAX/y : y < IMIN/x) : (y > 0 ? x < IMIN/y : x < IMAX/y))
        throw Error("Integer overflow (64-bit limit).");
    return x*y;
}
bool numeric(const Value& v) { return v.is<I>() || v.is<double>() || v.is<bool>(); }
I integer(const Value& v) {
    if (v.is<I>()) return v.get<I>();
    if (v.is<bool>()) return v.get<bool>() ? 1 : 0;
    throw Error("Expected a whole number.");
}
double real(const Value& v) {
    if (v.is<double>()) return v.get<double>();
    return static_cast<double>(integer(v));
}
Value floating(double v) {
    if (!std::isfinite(v)) throw Error("Numeric result is not finite.");
    return Value(v);
}
const std::string& string(const Value& v) {
    if (!v.is<std::string>()) throw Error("Expected text.");
    return v.get<std::string>();
}
bool truth(const Value& v) {
    if (v.is<std::monostate>()) return false;
    if (v.is<bool>()) return v.get<bool>();
    if (v.is<I>()) return v.get<I>() != 0;
    if (v.is<double>()) return v.get<double>() != 0;
    if (v.is<std::string>()) return !v.get<std::string>().empty();
    if (v.is<std::shared_ptr<List>>()) return !v.get<std::shared_ptr<List>>()->values.empty();
    if (v.is<std::shared_ptr<Dict>>()) return !v.get<std::shared_ptr<Dict>>()->values.empty();
    return true;
}
int numeric_order(const Value& a, const Value& b) {
    // Compare int/double without rounding large integers to double.
    if (!a.is<double>() && !b.is<double>()) {
        I x = integer(a), y = integer(b); return x < y ? -1 : x > y ? 1 : 0;
    }
    if (a.is<double>() && b.is<double>()) {
        double x=a.get<double>(), y=b.get<double>(); return x < y ? -1 : x > y ? 1 : 0;
    }
    if (a.is<double>()) return -numeric_order(b, a);
    I x = integer(a); double y = b.get<double>();
    if (y >= 9223372036854775808.0) return -1;
    if (y < -9223372036854775808.0) return 1;
    I yi = static_cast<I>(y);
    if (x < yi) return -1;
    if (x > yi) return 1;
    double fraction = y - static_cast<double>(yi);
    return fraction > 0 ? -1 : fraction < 0 ? 1 : 0;
}
bool equal(const Value& a, const Value& b, int depth=0) {
    if (depth > 256) throw Error("Values are nested too deeply.");
    if (numeric(a) && numeric(b)) return numeric_order(a,b) == 0;
    if (a.data.index() != b.data.index()) return false;
    if (a.is<std::monostate>()) return true;
    if (a.is<std::string>()) return a.get<std::string>() == b.get<std::string>();
    if (a.is<std::shared_ptr<List>>()) {
        const auto& x=a.get<std::shared_ptr<List>>()->values; const auto& y=b.get<std::shared_ptr<List>>()->values;
        if (x.size() != y.size()) return false;
        for (std::size_t i=0; i<x.size(); ++i) if (!equal(x[i],y[i],depth+1)) return false;
        return true;
    }
    if (a.is<std::shared_ptr<Dict>>()) {
        const auto& x=a.get<std::shared_ptr<Dict>>()->values; const auto& y=b.get<std::shared_ptr<Dict>>()->values;
        if (x.size() != y.size()) return false;
        for (const auto& entry:x) {
            bool found=false;
            for (const auto& other:y) if (equal(entry.first,other.first,depth+1)) {
                if (!equal(entry.second,other.second,depth+1)) return false;
                found=true; break;
            }
            if (!found) return false;
        }
        return true;
    }
    if (a.is<std::shared_ptr<Function>>()) return a.get<std::shared_ptr<Function>>() == b.get<std::shared_ptr<Function>>();
    if (a.is<Builtin>()) return a.get<Builtin>().name == b.get<Builtin>().name;
    if (a.is<Range>()) { auto x=a.get<Range>(), y=b.get<Range>(); return x.start==y.start && x.stop==y.stop && x.step==y.step; }
    return false;
}
int order(const Value& a, const Value& b, int depth=0) {
    if (depth > 256) throw Error("Values are nested too deeply.");
    if (numeric(a) && numeric(b)) return numeric_order(a,b);
    if (a.is<std::string>() && b.is<std::string>()) return a.get<std::string>().compare(b.get<std::string>());
    if (a.is<std::shared_ptr<List>>() && b.is<std::shared_ptr<List>>()) {
        const auto& x=a.get<std::shared_ptr<List>>()->values; const auto& y=b.get<std::shared_ptr<List>>()->values;
        for (std::size_t i=0; i<std::min(x.size(),y.size()); ++i) if (!equal(x[i],y[i])) return order(x[i],y[i],depth+1);
        return x.size()<y.size() ? -1 : x.size()>y.size() ? 1 : 0;
    }
    throw Error("These values cannot be compared in order.");
}
void key_ok(const Value& key) {
    if (!(numeric(key) || key.is<std::string>() || key.is<std::monostate>()))
        throw Error("Dictionary keys must be text, numbers, booleans, or nothing.");
}
std::string display(const Value&, bool=false, int=0);
void dict_set(const std::shared_ptr<Dict>& dict, Value key, Value value) {
    key_ok(key);
    for (auto& entry:dict->values) if (equal(entry.first,key)) { entry.second=std::move(value); return; }
    dict->values.emplace_back(std::move(key),std::move(value));
}
Value dict_get(const std::shared_ptr<Dict>& dict, const Value& key) {
    key_ok(key);
    for (const auto& entry:dict->values) if (equal(entry.first,key)) return entry.second;
    throw Error("That dictionary key does not exist: " + display(key) + ".");
}
const void* identity(const Value& value) {
    if (value.is<std::shared_ptr<List>>()) return value.get<std::shared_ptr<List>>().get();
    if (value.is<std::shared_ptr<Dict>>()) return value.get<std::shared_ptr<Dict>>().get();
    return nullptr;
}
bool contains_container(const Value& value, const void* target, std::unordered_set<const void*>& seen, int depth=0) {
    if (depth>256) throw Error("Values are nested too deeply.");
    const void* id=identity(value);
    if (!id) return false;
    if (id==target) return true;
    if (!seen.insert(id).second) return false;
    if (value.is<std::shared_ptr<List>>()) {
        for (const auto& item:value.get<std::shared_ptr<List>>()->values)
            if (contains_container(item,target,seen,depth+1)) return true;
    } else {
        for (const auto& item:value.get<std::shared_ptr<Dict>>()->values)
            if (contains_container(item.second,target,seen,depth+1)) return true;
    }
    return false;
}
void no_cycle(const Value& container, const Value& value) {
    std::unordered_set<const void*> seen;
    if (identity(container) && contains_container(value,identity(container),seen))
        throw Error("A list or dictionary cannot contain itself.");
}
std::size_t position(const Value& key, std::size_t size) {
    I n=integer(key);
    if (n<0) n+=static_cast<I>(size);
    if (n<0 || static_cast<std::uint64_t>(n)>=size)
        throw Error("That list/text position does not exist. Positions start at 0.");
    return static_cast<std::size_t>(n);
}
Value indexed(const Value& object, const Value& key) {
    if (object.is<std::shared_ptr<List>>()) { const auto& a=object.get<std::shared_ptr<List>>()->values; return a[position(key,a.size())]; }
    if (object.is<std::shared_ptr<Dict>>()) return dict_get(object.get<std::shared_ptr<Dict>>(),key);
    if (object.is<std::string>()) { auto a=characters(object.get<std::string>()); return Value(a[position(key,a.size())]); }
    if (object.is<Range>()) {
        auto r=object.get<Range>();
        I distance=r.step>0 ? checked_sub(r.stop,r.start) : checked_sub(r.start,r.stop);
        I length=checked_add(distance,1), n=integer(key);
        if (n<0) n=checked_add(n,length);
        if (n<0 || n>=length) throw Error("That sequence position does not exist.");
        return Value(r.step>0 ? checked_add(r.start,n) : checked_sub(r.start,n));
    }
    throw Error("This value cannot be indexed.");
}
void set_index(const Value& object, const Value& key, Value value) {
    no_cycle(object,value);
    if (object.is<std::shared_ptr<List>>()) { auto& a=object.get<std::shared_ptr<List>>()->values; a[position(key,a.size())]=std::move(value); }
    else if (object.is<std::shared_ptr<Dict>>()) dict_set(object.get<std::shared_ptr<Dict>>(),key,std::move(value));
    else throw Error("Only list and dictionary items can be assigned.");
}
Value arithmetic(const std::string& op, const Value& x, const Value& y) {
    if (op=="+" && x.is<std::string>() && y.is<std::string>()) return Value(x.get<std::string>()+y.get<std::string>());
    if (op=="+" && x.is<std::shared_ptr<List>>() && y.is<std::shared_ptr<List>>()) {
        auto result=std::make_shared<List>(); result->values=x.get<std::shared_ptr<List>>()->values;
        const auto& other=y.get<std::shared_ptr<List>>()->values;
        result->values.insert(result->values.end(),other.begin(),other.end()); return Value(result);
    }
    if (op=="*" && ((x.is<std::string>() || x.is<std::shared_ptr<List>>()) && (y.is<I>() || y.is<bool>()))) {
        I times=integer(y);
        if (x.is<std::string>()) { std::string s; for (I i=0;i<times;++i) s+=x.get<std::string>(); return Value(s); }
        auto result=std::make_shared<List>(); const auto& original=x.get<std::shared_ptr<List>>()->values;
        for (I i=0;i<times;++i) result->values.insert(result->values.end(),original.begin(),original.end());
        return Value(result);
    }
    if (op=="*" && (x.is<I>() || x.is<bool>()) && (y.is<std::string>() || y.is<std::shared_ptr<List>>())) return arithmetic(op,y,x);
    if (!numeric(x) || !numeric(y)) throw Error("These values cannot be used this way: expected numbers or compatible collections.");
    if (!x.is<double>() && !y.is<double>() && op!="/") {
        I a=integer(x), b=integer(y);
        if (op=="+") return Value(checked_add(a,b));
        if (op=="-") return Value(checked_sub(a,b));
        if (op=="*") return Value(checked_mul(a,b));
        if (op=="//" || op=="%") {
            if (b==0) throw Error("Cannot divide by zero.");
            if (a==IMIN && b==-1) {
                if (op=="%") return Value(I(0));
                throw Error("Integer overflow (64-bit limit).");
            }
            I q=a/b, r=a%b;
            if (r!=0 && ((r<0)!=(b<0))) { --q; r+=b; }
            return Value(op=="//" ? q : r);
        }
        if (op=="**" && b>=0) {
            I result=1;
            while (b) { if (b&1) result=checked_mul(result,a); b/=2; if (b) a=checked_mul(a,a); }
            return Value(result);
        }
    }
    double a=real(x), b=real(y);
    if ((op=="/" || op=="//" || op=="%") && b==0) throw Error("Cannot divide by zero.");
    if (op=="+") return floating(a+b);
    if (op=="-") return floating(a-b);
    if (op=="*") return floating(a*b);
    if (op=="/") return floating(a/b);
    if (op=="//") return floating(std::floor(a/b));
    if (op=="%") { double r=std::fmod(a,b); if (r!=0 && ((r<0)!=(b<0))) r+=b; return floating(r); }
    if (op=="**") return floating(std::pow(a,b));
    throw Error("Unknown arithmetic operator.");
}
bool membership(const Value& x, const Value& y) {
    if (y.is<std::string>()) return string(y).find(string(x))!=std::string::npos;
    if (y.is<std::shared_ptr<List>>()) { for (const auto& v:y.get<std::shared_ptr<List>>()->values) if (equal(x,v)) return true; return false; }
    if (y.is<std::shared_ptr<Dict>>()) { key_ok(x); for (const auto& v:y.get<std::shared_ptr<Dict>>()->values) if (equal(x,v.first)) return true; return false; }
    if (y.is<Range>()) { auto r=y.get<Range>(); if (!numeric(x)) return false; if (x.is<double>() && std::floor(real(x))!=real(x)) return false; return r.step>0 ? numeric_order(x,Value(r.start))>=0 && numeric_order(x,Value(r.stop))<=0 : numeric_order(x,Value(r.stop))>=0 && numeric_order(x,Value(r.start))<=0; }
    throw Error("Use in with text, a list, a dictionary, or a number sequence.");
}
bool compare(const std::string& op, const Value& x, const Value& y) {
    if (op=="==" || op=="is") return equal(x,y);
    if (op=="!=") return !equal(x,y);
    if (op=="in") return membership(x,y);
    int c=order(x,y);
    if (op=="<") return c<0;
    if (op=="<=") return c<=0;
    if (op==">") return c>0;
    return c>=0;
}

const std::unordered_set<std::string> keywords={"say","if","else","end","repeat","as","for","in","while","function","return","break","continue","and","or","not","true","false","nothing","is"};
enum class TK { Name, Number, String, Op, Eof };
struct Token { TK kind; std::string text; Value value; int column; };
bool digit(char c) { return c>='0' && c<='9'; }
bool name_start(unsigned char c) { return (c>='a' && c<='z') || (c>='A' && c<='Z') || c=='_' || c>=0x80; }
std::vector<Token> lex(const std::string& source, int line) {
    std::vector<Token> tokens;
    std::size_t i=0;
    try {
        while (i<source.size()) {
            auto start=i; char c=source[i];
            if (c==' ' || c=='\t' || c=='\r') { ++i; continue; }
            if (c=='#') break;
            if (name_start(static_cast<unsigned char>(c))) {
                while (i<source.size() && (name_start(static_cast<unsigned char>(source[i])) || digit(source[i]))) ++i;
                tokens.push_back({TK::Name,source.substr(start,i-start),{},static_cast<int>(start+1)}); continue;
            }
            if (digit(c) || (c=='.' && i+1<source.size() && digit(source[i+1]))) {
                while (i<source.size() && digit(source[i])) ++i;
                if (i<source.size() && source[i]=='.') { ++i; while (i<source.size() && digit(source[i])) ++i; }
                if (i<source.size() && (source[i]=='e' || source[i]=='E')) {
                    ++i; if (i<source.size() && (source[i]=='+' || source[i]=='-')) ++i;
                    if (i>=source.size() || !digit(source[i])) throw Error("Invalid numeric exponent.");
                    while (i<source.size() && digit(source[i])) ++i;
                }
                auto raw=source.substr(start,i-start); Value v;
                try { v=raw.find_first_of(".eE")==std::string::npos ? Value(static_cast<I>(std::stoll(raw))) : floating(std::stod(raw)); }
                catch (const std::out_of_range&) { throw Error("Number is outside the supported 64-bit/float range."); }
                tokens.push_back({TK::Number,raw,v,static_cast<int>(start+1)}); continue;
            }
            if (c=='\'' || c=='"') {
                const char quote=c; ++i; std::string result;
                while (i<source.size() && source[i]!=quote) {
                    char next=source[i++];
                    if (next!='\\') { result+=next; continue; }
                    if (i>=source.size()) throw Error("Unexpected character: unclosed quoted text.");
                    next=source[i++];
                    if (next=='n') result+='\n'; else if (next=='t') result+='\t'; else if (next=='r') result+='\r';
                    else if (next=='b') result+='\b'; else if (next=='f') result+='\f'; else if (next=='a') result+='\a'; else if (next=='v') result+='\v';
                    else if (next=='\\' || next=='\'' || next=='"') result+=next;
                    else if (next=='u' || next=='U' || next=='x') {
                        int n=next=='u' ? 4 : next=='U' ? 8 : 2; std::uint32_t cp=0;
                        for (int j=0;j<n;++j) {
                            if (i>=source.size()) throw Error("Incomplete Unicode escape.");
                            char h=source[i++]; int hex=h>='0' && h<='9' ? h-'0' : h>='a' && h<='f' ? h-'a'+10 : h>='A' && h<='F' ? h-'A'+10 : -1;
                            if (hex<0) throw Error("Invalid Unicode escape.");
                            cp=cp*16+static_cast<unsigned>(hex);
                        }
                        result+=utf8(cp);
                    } else if (next>='0' && next<='7') {
                        unsigned cp=static_cast<unsigned>(next-'0');
                        for (int j=1;j<3 && i<source.size() && source[i]>='0' && source[i]<='7';++j) cp=cp*8+static_cast<unsigned>(source[i++]-'0');
                        result+=utf8(cp);
                    } else { result+='\\'; result+=next; }
                }
                if (i>=source.size()) throw Error("Unexpected character: unclosed quoted text.");
                ++i; characters(result);
                tokens.push_back({TK::String,result,Value(result),static_cast<int>(start+1)}); continue;
            }
            auto pair=source.substr(i,2);
            if (pair=="==" || pair=="!=" || pair=="<=" || pair==">=" || pair=="**" || pair=="//") { tokens.push_back({TK::Op,pair,{},static_cast<int>(i+1)}); i+=2; continue; }
            if (std::string("+*/%<>=()[]{},:-").find(c)!=std::string::npos) { tokens.push_back({TK::Op,std::string(1,c),{},static_cast<int>(i+1)}); ++i; continue; }
            throw Error("Unexpected character at column " + std::to_string(i+1) + ".");
        }
    } catch (Error& e) { e.line=line; throw; }
    tokens.push_back({TK::Eof,"<end of line>",{},static_cast<int>(source.size()+1)});
    return tokens;
}
enum class EK { Literal, Name, List, Dict, Unary, Binary, Compare, Call, Index };
struct Expr;
using EP=std::shared_ptr<Expr>;
struct Expr { EK kind; Value value; std::string text; std::vector<EP> kids; std::vector<std::string> ops; explicit Expr(EK k):kind(k){} };
EP expr(EK kind, std::string text={}, std::vector<EP> kids={}) { auto p=std::make_shared<Expr>(kind); p->text=std::move(text); p->kids=std::move(kids); return p; }
EP literal(Value value) { auto p=expr(EK::Literal); p->value=std::move(value); return p; }
class Expressions {
    const std::vector<Token>& tokens;
    int source_line; std::size_t pos=0; int depth=0;
    static int power(const Token& t) {
        if (t.kind!=TK::Op && t.kind!=TK::Name) return -1;
        const auto& s=t.text;
        if (s=="or") return 10;
        if (s=="and") return 20;
        if (s=="==" || s=="!=" || s=="<" || s=="<=" || s==">" || s==">=" || s=="is" || s=="in") return 30;
        if (s=="+" || s=="-") return 40;
        if (s=="*" || s=="/" || s=="//" || s=="%") return 50;
        if (s=="**") return 70;
        return -1;
    }
public:
    Expressions(const std::vector<Token>& t,int line):tokens(t),source_line(line){}
    const Token& token() const { return tokens[pos]; }
    bool at(const std::string& s) const { return token().kind!=TK::String && token().kind!=TK::Number && token().text==s; }
    Token take() { if (token().kind==TK::Eof) throw Error("Expected a value; found end of line.",source_line); return tokens[pos++]; }
    Token take(const std::string& s) { if (!at(s)) throw Error("Expected '"+s+"'; found '"+token().text+"'.",source_line); return take(); }
    bool accept(const std::string& s) { if (!at(s)) return false; take(); return true; }
    std::string name() { if (token().kind!=TK::Name || keywords.count(token().text)) throw Error("Expected a variable or function name.",source_line); return take().text; }
    void finish() const { if (token().kind!=TK::Eof) throw Error("Unexpected '"+token().text+"'. Check this line.",source_line); }
    std::vector<EP> comma_list(const std::string& close="") {
        std::vector<EP> items;
        if ((!close.empty() && accept(close)) || (close.empty() && token().kind==TK::Eof)) return items;
        do { items.push_back(expression()); if (!accept(",")) break; } while (close.empty() || !at(close));
        if (!close.empty()) take(close);
        return items;
    }
    EP expression(int minimum=0) {
        struct Guard { int& d; explicit Guard(int& n):d(n){if (++d>256) throw Error("Expression is nested too deeply.");} ~Guard(){--d;} } guard(depth);
        EP left;
        auto t=token();
        if (t.kind==TK::Number || t.kind==TK::String) { take(); left=literal(t.value); }
        else if (at("true") || at("false") || at("nothing")) { take(); left=literal(t.text=="nothing" ? Value() : Value(t.text=="true")); }
        else if (at("not") || at("-") || at("+")) { take(); left=expr(EK::Unary,t.text,{expression(t.text=="not" ? 25 : 60)}); }
        else if (accept("(")) { left=expression(); take(")"); }
        else if (accept("[")) left=expr(EK::List,"",comma_list("]"));
        else if (accept("{")) {
            left=expr(EK::Dict);
            if (!accept("}")) {
                do { left->kids.push_back(expression()); take(":"); left->kids.push_back(expression()); if (!accept(",")) break; } while (!at("}"));
                take("}");
            }
        } else if (t.kind==TK::Name && !keywords.count(t.text)) left=expr(EK::Name,name());
        else throw Error("Expected a value; found '"+t.text+"'.",source_line);
        while (true) {
            if (at("(") && minimum<=90) { take(); auto args=comma_list(")"); args.insert(args.begin(),left); left=expr(EK::Call,"",std::move(args)); continue; }
            if (at("[") && minimum<=90) { take(); auto index=expression(); take("]"); left=expr(EK::Index,"",{left,index}); continue; }
            int p=power(token());
            if (p<minimum) break;
            if (p==30) {
                auto chain=expr(EK::Compare,"",{left});
                while (power(token())==30) {
                    auto op=take().text; if (op=="is" && accept("not")) op="!=";
                    chain->ops.push_back(op); chain->kids.push_back(expression(31));
                }
                left=chain;
            } else {
                auto op=take().text; auto right=expression(op=="**" ? p : p+1);
                left=expr(EK::Binary,op,{left,right});
            }
        }
        return left;
    }
};
enum class SK { Say, Assign, Expression, If, While, Repeat, For, Function, Return, Break, Continue };
struct Statement;
using SP=std::shared_ptr<Statement>;
using Block=std::vector<SP>;
struct Statement {
    SK kind; int line; std::string name; std::vector<std::string> params;
    std::vector<EP> expressions; Block body, otherwise;
    std::vector<std::pair<EP,Block>> branches;
    Statement(SK k,int l):kind(k),line(l){}
};
class Parser {
    struct Line { int number; std::vector<Token> tokens; };
    std::vector<Line> lines; std::size_t pos=0; int block_depth=0;
    void end(int opener) {
        if (pos==lines.size()) throw Error("This block needs an end on its own line.",opener);
        Expressions p(lines[pos].tokens,lines[pos].number);
        if (!p.accept("end")) throw Error("Expected end for the block starting on line "+std::to_string(opener)+".",lines[pos].number);
        p.finish(); ++pos;
    }
    Block block(bool in_function=false, bool in_loop=false) {
        struct Guard { int& n; explicit Guard(int& d):n(d){ if (++n>128) throw Error("Blocks are nested too deeply."); } ~Guard(){--n;} } guard(block_depth);
        Block result;
        while (pos<lines.size()) {
            const auto& line=lines[pos]; Expressions p(line.tokens,line.number);
            if (p.at("end") || p.at("else")) break;
            ++pos;
            SP s;
            if (p.accept("say")) { s=std::make_shared<Statement>(SK::Say,line.number); s->expressions=p.comma_list(); }
            else if (p.at("if") || p.at("while")) {
                bool is_if=p.take().text=="if";
                s=std::make_shared<Statement>(is_if ? SK::If : SK::While,line.number);
                auto condition=p.expression(); p.finish(); auto body=block(in_function,in_loop || !is_if);
                if (is_if) {
                    s->branches.emplace_back(condition,std::move(body));
                    while (pos<lines.size()) {
                        const auto& other=lines[pos]; Expressions ep(other.tokens,other.number);
                        if (!ep.accept("else")) break;
                        ++pos;
                        if (ep.accept("if")) { auto cond=ep.expression(); ep.finish(); auto branch=block(in_function,in_loop); s->branches.emplace_back(cond,std::move(branch)); }
                        else { ep.finish(); s->otherwise=block(in_function,in_loop); break; }
                    }
                } else { s->expressions={condition}; s->body=std::move(body); }
                end(line.number);
            } else if (p.at("repeat") || p.at("for")) {
                bool repeat=p.take().text=="repeat";
                s=std::make_shared<Statement>(repeat ? SK::Repeat : SK::For,line.number);
                if (!repeat) { s->name=p.name(); p.take("in"); }
                s->expressions.push_back(p.expression());
                if (repeat && p.accept("as")) s->name=p.name();
                p.finish(); s->body=block(in_function,true); end(line.number);
            } else if (p.accept("function")) {
                s=std::make_shared<Statement>(SK::Function,line.number); s->name=p.name(); p.take("(");
                if (!p.accept(")")) {
                    do { s->params.push_back(p.name()); } while (p.accept(","));
                    p.take(")");
                }
                std::unordered_set<std::string> unique(s->params.begin(),s->params.end());
                if (unique.size()!=s->params.size()) throw Error("Function parameter names must be different.",line.number);
                p.finish(); s->body=block(true,false); end(line.number);
            } else if (p.accept("return")) {
                if (!in_function) throw Error("Use return inside a function.",line.number);
                s=std::make_shared<Statement>(SK::Return,line.number);
                s->expressions.push_back(p.token().kind==TK::Eof ? literal(Value()) : p.expression());
            } else if (p.at("break") || p.at("continue")) {
                std::string name=p.take().text;
                if (!in_loop) throw Error("Use "+name+" inside a loop.",line.number);
                s=std::make_shared<Statement>(name=="break" ? SK::Break : SK::Continue,line.number);
            } else {
                auto left=p.expression();
                s=std::make_shared<Statement>(SK::Expression,line.number); s->expressions.push_back(left);
                if (p.accept("=")) {
                    if (left->kind!=EK::Name && left->kind!=EK::Index) throw Error("Assign to a name or a list/dictionary item.",line.number);
                    s->kind=SK::Assign; s->expressions.push_back(p.expression());
                }
            }
            p.finish(); result.push_back(std::move(s));
        }
        return result;
    }
public:
    explicit Parser(std::string source) {
        if (source.compare(0,3,"\xEF\xBB\xBF")==0) source.erase(0,3);
        characters(source);
        std::istringstream input(source); std::string line; int number=0;
        while (std::getline(input,line)) {
            ++number;
            for (char c:line) { if (c=='\t') throw Error("Use spaces instead of tabs.",number); if (c!=' ') break; }
            auto tokens=lex(line,number);
            if (tokens.size()>1) lines.push_back({number,std::move(tokens)});
        }
    }
    Block parse() {
        auto result=block();
        if (pos!=lines.size()) throw Error("This end or else has no matching block.",lines[pos].number);
        return result;
    }
};
struct Env {
    std::unordered_map<std::string,Value> values;
    std::shared_ptr<Env> parent;
    bool registered=false;
    explicit Env(std::shared_ptr<Env> p=nullptr):parent(std::move(p)){}
    Value get(const std::string& name) const {
        auto found=values.find(name);
        if (found!=values.end()) return found->second;
        if (parent) return parent->get(name);
        throw Error("I do not know '"+name+"'. Set it before using it.");
    }
};
struct Function {
    std::string name; std::vector<std::string> params; Block body; std::shared_ptr<Env> closure;
    std::shared_ptr<Code> bytecode; std::shared_ptr<VMEnv> capture;
};
std::string display(const Value& v,bool nested,int depth) {
    if (depth>256) throw Error("Values are nested too deeply.");
    if (v.is<std::monostate>()) return "nothing";
    if (v.is<bool>()) return v.get<bool>() ? "true" : "false";
    if (v.is<I>()) return std::to_string(v.get<I>());
    if (v.is<double>()) {
        std::ostringstream out; out<<std::setprecision(15)<<v.get<double>(); auto s=out.str();
        if (s.find_first_of(".eE")==std::string::npos) s+=".0";
        return s;
    }
    if (v.is<std::string>()) {
        const auto& s=v.get<std::string>(); if (!nested) return s;
        char quote=s.find('\'')!=std::string::npos && s.find('"')==std::string::npos ? '"' : '\'';
        std::string result(1,quote);
        for (char c:s) {
            if (c==quote || c=='\\') { result+='\\'; result+=c; }
            else if (c=='\n') result+="\\n"; else if (c=='\r') result+="\\r"; else if (c=='\t') result+="\\t";
            else result+=c;
        }
        return result+quote;
    }
    if (v.is<std::shared_ptr<List>>()) {
        std::string out="["; const auto& a=v.get<std::shared_ptr<List>>()->values;
        for (std::size_t i=0;i<a.size();++i) { if (i) out+=", "; out+=display(a[i],true,depth+1); } return out+"]";
    }
    if (v.is<std::shared_ptr<Dict>>()) {
        std::string out="{"; bool first=true;
        for (const auto& entry:v.get<std::shared_ptr<Dict>>()->values) {
            if (!first) out+=", ";
            first=false;
            out+=display(entry.first,true,depth+1)+": "+display(entry.second,true,depth+1);
        }
        return out+"}";
    }
    if (v.is<std::shared_ptr<Function>>()) return "<function "+v.get<std::shared_ptr<Function>>()->name+">";
    if (v.is<Builtin>()) return "<built-in function>";
    auto r=v.get<Range>(); return "<numbers "+std::to_string(r.start)+" to "+std::to_string(r.stop)+">";
}
// One lazy iterator per loop; no vector allocation for numeric loops.
struct Iterator {
    Value source; std::size_t pos=0; I current=0; bool done=false;
    std::vector<std::string> chars;
    explicit Iterator(Value v):source(std::move(v)) {
        if (source.is<Range>()) current=source.get<Range>().start;
        else if (source.is<std::string>()) chars=characters(string(source));
        else if (!source.is<std::shared_ptr<List>>() && !source.is<std::shared_ptr<Dict>>()) throw Error("This value cannot be looped over.");
    }
    bool next(Value& value) {
        if (source.is<Range>()) {
            if (done) return false;
            auto r=source.get<Range>(); value=Value(current);
            if (current==r.stop) done=true; else current+=r.step;
            return true;
        }
        if (source.is<std::string>()) { if (pos>=chars.size()) return false; value=Value(chars[pos++]); return true; }
        if (source.is<std::shared_ptr<List>>()) { auto& a=source.get<std::shared_ptr<List>>()->values; if (pos>=a.size()) return false; value=a[pos++]; return true; }
        auto& a=source.get<std::shared_ptr<Dict>>()->values; if (pos>=a.size()) return false; value=a[pos++].first; return true;
    }
};
struct Flow { SK kind; Value value; };
class Runtime {
protected:
    I steps=0, max_steps; int call_depth=0, expression_depth=0;
    std::vector<std::weak_ptr<Env>> environments;
    void register_env(const std::shared_ptr<Env>& env) { if (!env->registered) { env->registered=true; environments.push_back(env); } }
    void tick() { if (steps>=max_steps) throw Error("Step limit reached. Check for a loop that never stops."); ++steps; }
    Value evaluate(const EP& p, const std::shared_ptr<Env>& env) {
        tick();
        struct Guard { int& n; explicit Guard(int& d):n(d){if (n>=512) throw Error("Too many nested calls or expressions."); ++n;} ~Guard(){--n;} } guard(expression_depth);
        const auto& k=p->kids;
        switch (p->kind) {
        case EK::Literal: return p->value;
        case EK::Name: return env->get(p->text);
        case EK::List: { auto a=std::make_shared<List>(); for (const auto& kid:k) a->values.push_back(evaluate(kid,env)); return Value(a); }
        case EK::Dict: { auto d=std::make_shared<Dict>(); for (std::size_t i=0;i<k.size();i+=2) { auto key=evaluate(k[i],env); auto value=evaluate(k[i+1],env); dict_set(d,key,value); } return Value(d); }
        case EK::Index: { auto object=evaluate(k[0],env); auto key=evaluate(k[1],env); return indexed(object,key); }
        case EK::Unary: {
            auto v=evaluate(k[0],env);
            if (p->text=="not") return Value(!truth(v));
            if (!numeric(v)) throw Error("Unary + or - needs a number.");
            if (p->text=="+") return v.is<bool>() ? Value(integer(v)) : v;
            return v.is<double>() ? floating(-real(v)) : Value(checked_sub(0,integer(v)));
        }
        case EK::Binary: {
            auto left=evaluate(k[0],env);
            if (p->text=="and") return truth(left) ? evaluate(k[1],env) : left;
            if (p->text=="or") return truth(left) ? left : evaluate(k[1],env);
            auto right=evaluate(k[1],env); return arithmetic(p->text,left,right);
        }
        case EK::Compare: {
            auto left=evaluate(k[0],env);
            for (std::size_t i=0;i<p->ops.size();++i) {
                auto right=evaluate(k[i+1],env); if (!compare(p->ops[i],left,right)) return Value(false); left=std::move(right);
            }
            return Value(true);
        }
        case EK::Call: {
            auto function=evaluate(k[0],env); std::vector<Value> args;
            for (std::size_t i=1;i<k.size();++i) args.push_back(evaluate(k[i],env));
            if (function.is<Builtin>()) return builtin(function.get<Builtin>().name,args);
            if (!function.is<std::shared_ptr<Function>>()) throw Error("This value is not a function.");
            auto f=function.get<std::shared_ptr<Function>>();
            if (args.size()!=f->params.size()) throw Error(f->name+" needs "+std::to_string(f->params.size())+" values; got "+std::to_string(args.size())+".");
            struct Guard { int& n; explicit Guard(int& d):n(d){if (n>=128) throw Error("Too many nested function calls (limit 128)."); ++n;} ~Guard(){--n;} } guard(call_depth);
            auto local=std::make_shared<Env>(f->closure);
            for (std::size_t i=0;i<args.size();++i) local->values[f->params[i]]=std::move(args[i]);
            auto flow=block(f->body,local);
            if (flow) { if (flow->kind==SK::Return) return flow->value; throw Error("Unexpected loop control outside a loop."); }
            return Value();
        }
        }
        throw Error("Unknown expression.");
    }
    static void arity(const std::string& name,const std::vector<Value>& args,std::size_t low,std::size_t high) {
        if (args.size()<low || args.size()>high) throw Error(name+" needs "+std::to_string(low)+(low==high ? "" : " to "+std::to_string(high))+" values.");
    }
    std::vector<Value> collect(const Value& value) {
        Iterator iter(value); Value item; std::vector<Value> result;
        while (iter.next(item)) { tick(); result.push_back(item); }
        return result;
    }
    Value builtin(const std::string& name,const std::vector<Value>& args) {
        if (name=="ask") {
            arity(name,args,0,1); if (!args.empty()) { std::cout<<display(args[0]); std::cout.flush(); }
            std::string line; if (!std::getline(std::cin,line)) throw Error("No input was available for ask().");
            if (!line.empty() && line.back()=='\r') line.pop_back();
            characters(line);
            return Value(line);
        }
        if (name=="number") {
            arity(name,args,1,1); const auto& v=args[0]; if (numeric(v)) return v;
            auto s=string(v); auto first=s.find_first_not_of(" \r\n\t"), last=s.find_last_not_of(" \r\n\t");
            if (first==std::string::npos) throw Error("Cannot convert empty text to a number.");
            s=s.substr(first,last-first+1); std::size_t used=0;
            try {
                if (s.find_first_of(".eE")==std::string::npos) {
                    I n=std::stoll(s,&used); if (used!=s.size()) throw Error("Cannot convert this text to a number."); return Value(n);
                }
                double n=std::stod(s,&used); if (used!=s.size()) throw Error("Cannot convert this text to a number."); return floating(n);
            } catch (const std::invalid_argument&) { throw Error("Cannot convert this text to a number."); }
            catch (const std::out_of_range&) { throw Error("Number is outside the supported 64-bit/float range."); }
        }
        if (name=="text") { arity(name,args,1,1); return Value(display(args[0])); }
        if (name=="length") {
            arity(name,args,1,1); const auto& v=args[0];
            if (v.is<std::string>()) return Value(static_cast<I>(characters(string(v)).size()));
            if (v.is<std::shared_ptr<List>>()) return Value(static_cast<I>(v.get<std::shared_ptr<List>>()->values.size()));
            if (v.is<std::shared_ptr<Dict>>()) return Value(static_cast<I>(v.get<std::shared_ptr<Dict>>()->values.size()));
            if (v.is<Range>()) { auto r=v.get<Range>(); return Value(checked_add(r.step>0 ? checked_sub(r.stop,r.start) : checked_sub(r.start,r.stop),1)); }
            throw Error("length needs text, a collection, or a number sequence.");
        }
        if (name=="numbers") {
            arity(name,args,2,2);
            if (!args[0].is<I>() || !args[1].is<I>()) throw Error("numbers(start, stop) needs two whole numbers.");
            I start=integer(args[0]), stop=integer(args[1]); return Value(Range{start,stop,stop>=start ? I(1) : I(-1)});
        }
        if (name=="append") {
            arity(name,args,2,2); if (!args[0].is<std::shared_ptr<List>>()) throw Error("append needs a list as its first value.");
            no_cycle(args[0],args[1]); args[0].get<std::shared_ptr<List>>()->values.push_back(args[1]); return Value();
        }
        if (name=="upper" || name=="lower") {
            arity(name,args,1,1); auto s=string(args[0]);
            // ASCII case conversion is deterministic across operating systems.
            for (char& c:s) { if (name=="upper" && c>='a' && c<='z') c=static_cast<char>(c-'a'+'A'); else if (name=="lower" && c>='A' && c<='Z') c=static_cast<char>(c-'A'+'a'); }
            return Value(s);
        }
        if (name=="split") {
            arity(name,args,1,2); const auto& s=string(args[0]); auto out=std::make_shared<List>();
            if (args.size()==1 || args[1].is<std::monostate>()) {
                std::istringstream input(s); std::string part; while (input>>part) out->values.emplace_back(part);
            } else {
                const auto& sep=string(args[1]); if (sep.empty()) throw Error("split separator cannot be empty.");
                std::size_t pos=0, next;
                while ((next=s.find(sep,pos))!=std::string::npos) { out->values.emplace_back(s.substr(pos,next-pos)); pos=next+sep.size(); }
                out->values.emplace_back(s.substr(pos));
            }
            return Value(out);
        }
        if (name=="join") {
            arity(name,args,1,2); auto values=collect(args[0]); auto sep=args.size()==2 ? string(args[1]) : " "; std::string out;
            for (std::size_t i=0;i<values.size();++i) { if (i) out+=sep; out+=string(values[i]); } return Value(out);
        }
        if (name=="abs") { arity(name,args,1,1); if (args[0].is<double>()) return floating(std::fabs(real(args[0]))); I n=integer(args[0]); return Value(n<0 ? checked_sub(0,n) : n); }
        if (name=="sqrt") { arity(name,args,1,1); double n=real(args[0]); if (n<0) throw Error("sqrt needs a nonnegative number."); return floating(std::sqrt(n)); }
        if (name=="round") {
            arity(name,args,1,2); if (!numeric(args[0])) throw Error("round needs a number.");
            I places=args.size()==2 ? integer(args[1]) : 0;
            if (places < -308 || places > 308) throw Error("round places must be between -308 and 308.");
            if (!args[0].is<double>() && places>=0) return Value(integer(args[0]));
            double factor=std::pow(10.0,static_cast<double>(places)), scaled=real(args[0])*factor;
            if (!std::isfinite(scaled)) return args[0];
            double floor=std::floor(scaled), fraction=scaled-floor;
            double rounded=fraction<0.5 ? floor : fraction>0.5 ? floor+1 : std::fmod(floor,2.0)==0 ? floor : floor+1;
            double result=rounded/factor;
            if (args.size()==1) {
                if (result>=9223372036854775808.0 || result < -9223372036854775808.0) throw Error("Rounded result exceeds the 64-bit integer range.");
                return Value(static_cast<I>(result));
            }
            return floating(result);
        }
        if (name=="sum" || name=="min" || name=="max" || name=="sorted") {
            if (name=="min" || name=="max") { if (args.empty()) throw Error(name+" needs at least one value."); }
            else arity(name,args,1,1);
            auto values=args.size()==1 ? collect(args[0]) : args;
            if (name=="sum") { Value total(I(0)); for (const auto& v:values) total=arithmetic("+",total,v); return total; }
            if (name=="sorted") {
                std::stable_sort(values.begin(),values.end(),[](const Value& a,const Value& b){return order(a,b)<0;});
                auto result=std::make_shared<List>(); result->values=std::move(values); return Value(result);
            }
            if (values.empty()) throw Error(name+" needs a nonempty collection.");
            Value result=values[0]; for (std::size_t i=1;i<values.size();++i) { int c=order(values[i],result); if (name=="min" ? c<0 : c>0) result=values[i]; }
            return result;
        }
        throw Error("Unknown built-in function.");
    }
    std::optional<Flow> statement(const SP& s,const std::shared_ptr<Env>& env) {
        const auto& a=s->expressions;
        switch (s->kind) {
        case SK::Say: {
            // Evaluate first, so an error does not print an incomplete line.
            std::vector<Value> values; for (const auto& e:a) values.push_back(evaluate(e,env));
            for (std::size_t i=0;i<values.size();++i) { if (i) std::cout<<' '; std::cout<<display(values[i]); } std::cout<<'\n'; break;
        }
        case SK::Assign: {
            auto value=evaluate(a[1],env);
            if (a[0]->kind==EK::Name) env->values[a[0]->text]=std::move(value);
            else { auto object=evaluate(a[0]->kids[0],env); auto key=evaluate(a[0]->kids[1],env); set_index(object,key,std::move(value)); }
            break;
        }
        case SK::Expression: evaluate(a[0],env); break;
        case SK::Function: {
            register_env(env); auto function=std::make_shared<Function>(); function->name=s->name; function->params=s->params; function->body=s->body; function->closure=env;
            env->values[s->name]=Value(function); break;
        }
        case SK::If: {
            for (const auto& branch:s->branches) if (truth(evaluate(branch.first,env))) return block(branch.second,env);
            return block(s->otherwise,env);
        }
        case SK::While: {
            while (true) {
                tick(); if (!truth(evaluate(a[0],env))) break;
                auto flow=block(s->body,env);
                if (flow) { if (flow->kind==SK::Break) break; if (flow->kind==SK::Continue) continue; return flow; }
            }
            break;
        }
        case SK::For: case SK::Repeat: {
            auto value=evaluate(a[0],env);
            if (s->kind==SK::Repeat) {
                if (!value.is<I>() || integer(value)<0) throw Error("repeat needs a whole number of 0 or more.");
                if (integer(value)==0) break;
                value=Value(Range{1,integer(value),1});
            }
            Iterator iter(value); Value item;
            while (true) {
                tick(); if (!iter.next(item)) break; if (!s->name.empty()) env->values[s->name]=item;
                auto flow=block(s->body,env);
                if (flow) { if (flow->kind==SK::Break) break; if (flow->kind==SK::Continue) continue; return flow; }
            }
            break;
        }
        case SK::Return: return Flow{SK::Return,evaluate(a[0],env)};
        case SK::Break: case SK::Continue: return Flow{s->kind,{}};
        }
        return std::nullopt;
    }
    std::optional<Flow> block(const Block& nodes,const std::shared_ptr<Env>& env) {
        for (const auto& node:nodes) {
            try { tick(); auto flow=statement(node,env); if (flow) return flow; }
            catch (Error& error) { if (!error.line) error.line=node->line; throw; }
        }
        return std::nullopt;
    }
public:
    std::shared_ptr<Env> globals=std::make_shared<Env>();
    explicit Runtime(I limit):max_steps(limit) {
        for (const std::string name:{"ask","number","text","length","numbers","append","upper","lower","split","join","round","abs","min","max","sum","sorted","sqrt"}) globals->values[name]=Value(Builtin{name});
    }
    ~Runtime() {
        // Break environment/function ownership cycles at interpreter shutdown.
        std::vector<std::shared_ptr<Env>> live;
        for (const auto& env:environments) if (auto p=env.lock()) live.push_back(std::move(p));
        for (const auto& env:live) env->values.clear();
    }
    void run(const Block& nodes) { steps=0; block(nodes,globals); }
};
#include "bytecode.hpp"

std::string read_file(const std::string& filename) {
    std::ifstream file(filename,std::ios::binary);
    if (!file) throw Error("Cannot read the program: "+filename);
    std::ostringstream buffer; buffer<<file.rdbuf(); return buffer.str();
}
void report(const Error& error,const std::string& source,const std::string& filename) {
    std::cerr<<filename<<": "; if (error.line) std::cerr<<"Line "<<error.line<<": "; std::cerr<<error.what()<<'\n';
    std::istringstream lines(source); std::string line;
    for (int n=1;n<=error.line && std::getline(lines,line);++n) if (n==error.line) {
        auto first=line.find_first_not_of(" \t\r"); std::cerr<<"  "<<(first==std::string::npos ? "" : line.substr(first))<<'\n';
    }
}
template<class Engine>
void repl(Engine& runtime) {
    std::cout<<"Milo 0.3.0 (C++17 bytecode VM) | Type help or exit. Close blocks with end.\n";
    while (true) {
        std::string source,line; int depth=0;
        try {
            do {
                std::cout<<(source.empty() ? "milo> " : "... "); std::cout.flush();
                if (!std::getline(std::cin,line)) { std::cout<<'\n'; return; }
                if (source.empty() && line=="exit") return;
                if (source.empty() && line=="help") { std::cout<<"Try: say \"Hello!\"\nBlocks: if, while, repeat, for, function; close each with end.\nRead README.md for the language guide.\n"; break; }
                source+=line+'\n'; auto tokens=lex(line,1);
                if (tokens[0].kind==TK::Name) {
                    const auto& first=tokens[0].text;
                    if (first=="if" || first=="while" || first=="repeat" || first=="for" || first=="function") ++depth;
                    else if (first=="end") --depth;
                }
                if (depth<=0) { runtime.run(Parser(source).parse()); break; }
            } while (true);
        } catch (const Error& e) { report(e,source,"<interactive>"); }
    }
}
} // namespace milo
int main(int argc,char** argv) {
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8); SetConsoleCP(CP_UTF8);
#endif
    std::ios::sync_with_stdio(false);
    std::string filename, source; bool check=false, tree=false, dump=false; milo::I max_steps=1000000;
    try {
        for (int i=1;i<argc;++i) {
            std::string arg=argv[i];
            if (arg=="--version") { std::cout<<"Milo 0.3.0 (C++17 bytecode VM)\n"; return 0; }
            if (arg=="--help" || arg=="-h") { std::cout<<"Usage: milo [--check | --dump-bytecode] [--tree] [--max-steps N] [program.milo]\nNo file starts the interactive prompt. Python is not required.\n"; return 0; }
            if (arg=="--check") check=true;
            else if (arg=="--tree") tree=true;
            else if (arg=="--dump-bytecode") dump=true;
            else if (arg=="--max-steps") {
                if (++i>=argc) throw milo::Error("--max-steps needs a positive integer.");
                std::size_t used=0; max_steps=std::stoll(argv[i],&used);
                if (used!=std::string(argv[i]).size() || max_steps<=0) throw milo::Error("--max-steps needs a positive integer.");
            } else if (!arg.empty() && arg[0]=='-') throw milo::Error("Unknown option: "+arg);
            else if (!filename.empty()) throw milo::Error("Provide one program file.");
            else filename=arg;
        }
        if (dump && (tree || check)) throw milo::Error("--dump-bytecode cannot be combined with --tree or --check.");
        milo::VMRuntime vm(max_steps);
        if (filename.empty()) {
            if (check || dump) throw milo::Error("--check and --dump-bytecode need a file.");
            if (tree) { milo::Runtime runtime(max_steps); milo::repl(runtime); }
            else milo::repl(vm);
        }
        else {
            source=milo::read_file(filename); auto program=milo::Parser(source).parse();
            if (tree) {
                if (check) std::cout<<"Syntax looks good.\n";
                else { milo::Runtime runtime(max_steps); runtime.run(program); }
            } else {
                auto code=vm.compile(program);
                if (check) std::cout<<"Syntax looks good.\n";
                else if (dump) milo::disassemble(code,vm.symbols);
                else vm.run(code);
            }
        }
        return 0;
    } catch (const milo::Error& e) { milo::report(e,source,filename.empty() ? "milo" : filename); }
    catch (const std::bad_alloc&) { std::cerr<<"Milo ran out of memory.\n"; }
    catch (const std::exception& e) { std::cerr<<"Milo: "<<e.what()<<'\n'; }
    return 1;
}
